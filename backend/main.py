from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sqlite3
import threading
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_routes import create_router
from long_term_sync import sync_long_term_data
from short_term_sync import sync_short_term_data
from sync_support import ApiBudgetExceeded


APP_NAME = "42 Warsaw Campus Dashboard API"
LONG_TERM_SYNC_INTERVAL = timedelta(days=30)
SHORT_TERM_SYNC_INTERVAL = timedelta(days=1)
COORDINATOR_POLL_INTERVAL_SECONDS = 3600

BASE_DIR = Path(__file__).resolve().parent


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def resolve_primary_campus_id(default: int = 67) -> int:
    raw_value = os.getenv("CAMPUS", str(default)).strip()
    try:
        return int(raw_value)
    except ValueError:
        return default


load_env_file(BASE_DIR.parent / ".env")
load_env_file(BASE_DIR / ".env")
PRIMARY_CAMPUS_ID = resolve_primary_campus_id()

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "dashboard_cache.db"
CONFIG_PATH = BASE_DIR / "config.yml"

refresh_stop_event = threading.Event()
refresh_thread: threading.Thread | None = None
long_term_sync_lock = threading.Lock()
short_term_sync_lock = threading.Lock()
sync_status_lock = threading.Lock()
long_term_sync_status: dict[str, Any] = {
    "state": "idle",
    "stage": None,
    "started_at": None,
    "finished_at": None,
    "processed": 0,
    "total": 0,
    "failures": 0,
    "last_error": None,
    "last_result": None,
}
short_term_sync_status: dict[str, Any] = {
    "state": "idle",
    "stage": None,
    "started_at": None,
    "finished_at": None,
    "last_error": None,
    "last_result": None,
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utcnow().isoformat()


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS campus_reference (
            campus_id INTEGER PRIMARY KEY,
            campus_name TEXT NOT NULL,
            city TEXT,
            country TEXT,
            last_seen_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS campus_metrics_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campus_id INTEGER NOT NULL,
            users_count INTEGER NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            FOREIGN KEY(campus_id) REFERENCES campus_reference(campus_id)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS refresh_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_name TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            success INTEGER NOT NULL,
            error_summary TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS coalition_reference (
            coalition_id INTEGER PRIMARY KEY,
            campus_id INTEGER NOT NULL,
            cursus_id INTEGER,
            coalition_name TEXT NOT NULL,
            slug TEXT,
            image_url TEXT,
            cover_url TEXT,
            color TEXT,
            last_seen_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS coalition_score_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coalition_id INTEGER NOT NULL,
            campus_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            FOREIGN KEY(coalition_id) REFERENCES coalition_reference(coalition_id)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS campus_user (
            user_id INTEGER PRIMARY KEY,
            campus_id INTEGER NOT NULL,
            login TEXT NOT NULL UNIQUE,
            first_name TEXT,
            last_name TEXT,
            url TEXT,
            kind TEXT,
            image TEXT,
            pool_month TEXT,
            pool_year TEXT,
            active INTEGER NOT NULL,
            alumni INTEGER NOT NULL,
            is_staff INTEGER NOT NULL DEFAULT 0,
            is_alumni INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 0,
            achievements_count INTEGER NOT NULL DEFAULT 0,
            last_seen_at TEXT NOT NULL
        )
        """
    )

    # Keep old DBs compatible when schema evolved from earlier versions.
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN url TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN kind TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN image TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN active INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN alumni INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN is_staff INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN is_alumni INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE campus_user ADD COLUMN achievements_count INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS short_term_metric_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campus_id INTEGER NOT NULL,
            metric_name TEXT NOT NULL,
            metric_value REAL,
            payload_json TEXT,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS achievement_reference (
            achievement_id INTEGER PRIMARY KEY,
            campus_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            tier TEXT,
            kind TEXT,
            visible INTEGER NOT NULL,
            nbr_of_success INTEGER,
            last_seen_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS achievement_metric_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campus_id INTEGER NOT NULL,
            achievement_id INTEGER NOT NULL,
            users_count INTEGER NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            FOREIGN KEY(achievement_id) REFERENCES achievement_reference(achievement_id)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS coalition_user_score_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campus_id INTEGER NOT NULL,
            coalition_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            rank INTEGER,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            FOREIGN KEY(coalition_id) REFERENCES coalition_reference(coalition_id)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS project_pass_event (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campus_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            project_name TEXT NOT NULL,
            projects_user_id INTEGER,
            marked_at TEXT NOT NULL,
            user_login TEXT,
            user_image_url TEXT,
            user_profile_url TEXT,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            UNIQUE(campus_id, user_id, project_id, marked_at)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS project_activity_event (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campus_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            project_name TEXT NOT NULL,
            projects_user_id INTEGER,
            activity_type TEXT NOT NULL,
            activity_at TEXT NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            UNIQUE(campus_id, projects_user_id, activity_type, activity_at)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS location_event (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campus_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            begin_at TEXT NOT NULL,
            end_at TEXT,
            host TEXT,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS cursus_user_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campus_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            cursus_id INTEGER NOT NULL,
            cursus_name TEXT,
            is_active INTEGER NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS weekly_user_logtime (
            campus_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            week_start_date TEXT NOT NULL,
            seconds_logged INTEGER NOT NULL,
            sessions_count INTEGER NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            PRIMARY KEY (campus_id, user_id, week_start_date)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS weekly_campus_attendance (
            campus_id INTEGER NOT NULL,
            week_start_date TEXT NOT NULL,
            unique_students_count INTEGER NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            PRIMARY KEY (campus_id, week_start_date)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS cursus_active_counts (
            campus_id INTEGER NOT NULL,
            cursus_id INTEGER NOT NULL,
            cursus_name TEXT,
            active_users_count INTEGER NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            PRIMARY KEY (campus_id, cursus_id, collected_at)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS weekly_project_activity_counts (
            campus_id INTEGER NOT NULL,
            week_start_date TEXT NOT NULL,
            active_or_started_projects_count INTEGER NOT NULL,
            created_events_count INTEGER NOT NULL,
            updated_events_count INTEGER NOT NULL,
            collected_at TEXT NOT NULL,
            source_status TEXT NOT NULL,
            PRIMARY KEY (campus_id, week_start_date)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sync_cursor (
            job_name TEXT NOT NULL,
            cursor_key TEXT NOT NULL,
            cursor_value TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (job_name, cursor_key)
        )
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_snapshots_campus_time
        ON campus_metrics_snapshot(campus_id, collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_snapshots_collected_at
        ON campus_metrics_snapshot(collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_campus_user_campus_login
        ON campus_user(campus_id, login)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_coalition_reference_campus
        ON coalition_reference(campus_id)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_coalition_score_campus_time
        ON coalition_score_snapshot(campus_id, collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_short_term_metric_campus_time
        ON short_term_metric_snapshot(campus_id, collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_achievement_reference_campus
        ON achievement_reference(campus_id)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_achievement_metric_campus_time
        ON achievement_metric_snapshot(campus_id, collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_achievement_metric_achievement_time
        ON achievement_metric_snapshot(achievement_id, collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_coalition_user_score_campus_time
        ON coalition_user_score_snapshot(campus_id, collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_coalition_user_score_user
        ON coalition_user_score_snapshot(campus_id, user_id)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_project_pass_event_campus_marked
        ON project_pass_event(campus_id, marked_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_project_pass_event_user
        ON project_pass_event(campus_id, user_id, marked_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_project_activity_event_campus_activity
        ON project_activity_event(campus_id, activity_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_project_activity_event_user
        ON project_activity_event(campus_id, user_id, activity_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_location_event_campus_begin
        ON location_event(campus_id, begin_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_location_event_user_begin
        ON location_event(campus_id, user_id, begin_at)
        """
    )

    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_location_event_dedupe
        ON location_event(campus_id, user_id, begin_at, ifnull(end_at, ''))
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_cursus_user_snapshot_active
        ON cursus_user_snapshot(campus_id, is_active, collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_weekly_user_logtime_top
        ON weekly_user_logtime(campus_id, week_start_date, seconds_logged)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_weekly_attendance_latest
        ON weekly_campus_attendance(campus_id, week_start_date)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_cursus_active_counts_latest
        ON cursus_active_counts(campus_id, collected_at)
        """
    )

    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_weekly_project_activity_latest
        ON weekly_project_activity_counts(campus_id, week_start_date)
        """
    )

    conn.commit()
    conn.close()


def log_refresh(job_name: str, started_at: str, success: bool, error_summary: str | None = None) -> None:
    finished_at = iso_now()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT INTO refresh_log (job_name, started_at, finished_at, success, error_summary)
        VALUES (?, ?, ?, ?, ?)
        """,
        (job_name, started_at, finished_at, int(success), error_summary),
    )
    conn.commit()
    conn.close()


def get_last_successful_refresh(job_name: str) -> datetime | None:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        """
        SELECT finished_at
        FROM refresh_log
        WHERE job_name = ? AND success = 1 AND finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
        """,
        (job_name,),
    ).fetchone()
    conn.close()

    if row is None:
        return None
    return parse_iso_datetime(row[0])


def should_run(job_name: str, interval: timedelta, force: bool = False) -> bool:
    if force:
        return True

    last_refresh = get_last_successful_refresh(job_name)
    if last_refresh is None:
        return True

    return utcnow() - last_refresh >= interval


def run_long_term_sync(force: bool = False) -> dict[str, Any]:
    if not long_term_sync_lock.acquire(blocking=False):
        return {
            "job_name": "long_term_sync",
            "ran": False,
            "in_progress": True,
            "source_mode": "in_progress",
        }

    if not should_run("long_term_sync", LONG_TERM_SYNC_INTERVAL, force=force):
        long_term_sync_lock.release()
        return {
            "job_name": "long_term_sync",
            "ran": False,
            "source_mode": "fresh_cache",
        }

    started_at = iso_now()

    with sync_status_lock:
        long_term_sync_status.update(
            {
                "state": "running",
                "stage": "starting",
                "started_at": started_at,
                "finished_at": None,
                "processed": 0,
                "total": 0,
                "failures": 0,
                "last_error": None,
            }
        )

    def progress_callback(payload: dict[str, Any]) -> None:
        with sync_status_lock:
            for key in ("stage", "processed", "total", "failures", "achievement_id"):
                if key in payload:
                    long_term_sync_status[key] = payload[key]

    try:
        result = sync_long_term_data(
            db_path=DB_PATH,
            config_path=CONFIG_PATH,
            campus_id=PRIMARY_CAMPUS_ID,
            progress_callback=progress_callback,
        )
        log_refresh("long_term_sync", started_at, success=True)
        with sync_status_lock:
            long_term_sync_status.update(
                {
                    "state": "completed",
                    "stage": "completed",
                    "finished_at": iso_now(),
                    "last_result": result,
                    "last_error": None,
                }
            )
        return {
            "job_name": "long_term_sync",
            "ran": True,
            "source_mode": "refreshed",
            **result,
        }
    except ApiBudgetExceeded as exc:
        log_refresh("long_term_sync", started_at, success=False, error_summary=str(exc))
        with sync_status_lock:
            long_term_sync_status.update(
                {
                    "state": "deferred",
                    "stage": "budget_limited",
                    "finished_at": iso_now(),
                    "last_error": str(exc),
                }
            )
        return {
            "job_name": "long_term_sync",
            "ran": False,
            "source_mode": "budget_limited",
            "budget_exhausted": True,
            "error": str(exc),
        }
    except Exception as exc:
        log_refresh("long_term_sync", started_at, success=False, error_summary=str(exc))
        with sync_status_lock:
            long_term_sync_status.update(
                {
                    "state": "failed",
                    "stage": "failed",
                    "finished_at": iso_now(),
                    "last_error": str(exc),
                }
            )
        raise
    finally:
        long_term_sync_lock.release()


def run_short_term_sync(force: bool = False) -> dict[str, Any]:
    if not short_term_sync_lock.acquire(blocking=False):
        return {
            "job_name": "short_term_sync",
            "ran": False,
            "in_progress": True,
            "source_mode": "in_progress",
        }

    if not should_run("short_term_sync", SHORT_TERM_SYNC_INTERVAL, force=force):
        short_term_sync_lock.release()
        return {
            "job_name": "short_term_sync",
            "ran": False,
            "source_mode": "fresh_cache",
        }

    started_at = iso_now()

    with sync_status_lock:
        short_term_sync_status.update(
            {
                "state": "running",
                "stage": "starting",
                "started_at": started_at,
                "finished_at": None,
                "last_error": None,
            }
        )

    try:
        result = sync_short_term_data(
            db_path=DB_PATH,
            config_path=CONFIG_PATH,
            campus_id=PRIMARY_CAMPUS_ID,
            force=force,
        )
        source_mode = str(result.get("source_mode") or "refreshed")
        ran = source_mode != "budget_limited"
        log_refresh("short_term_sync", started_at, success=True)
        with sync_status_lock:
            short_term_sync_status.update(
                {
                    "state": "deferred" if source_mode == "budget_limited" else "completed",
                    "stage": source_mode,
                    "finished_at": iso_now(),
                    "last_error": None,
                    "last_result": result,
                }
            )
        return {
            "job_name": "short_term_sync",
            "ran": ran,
            "source_mode": source_mode,
            **result,
        }
    except ApiBudgetExceeded as exc:
        log_refresh("short_term_sync", started_at, success=False, error_summary=str(exc))
        with sync_status_lock:
            short_term_sync_status.update(
                {
                    "state": "deferred",
                    "stage": "budget_limited",
                    "finished_at": iso_now(),
                    "last_error": str(exc),
                }
            )
        return {
            "job_name": "short_term_sync",
            "ran": False,
            "source_mode": "budget_limited",
            "budget_exhausted": True,
            "error": str(exc),
        }
    except Exception as exc:
        log_refresh("short_term_sync", started_at, success=False, error_summary=str(exc))
        with sync_status_lock:
            short_term_sync_status.update(
                {
                    "state": "failed",
                    "stage": "failed",
                    "finished_at": iso_now(),
                    "last_error": str(exc),
                }
            )
        raise
    finally:
        short_term_sync_lock.release()


def is_long_term_sync_running() -> bool:
    return long_term_sync_lock.locked()


def is_short_term_sync_running() -> bool:
    return short_term_sync_lock.locked()


def get_long_term_sync_status() -> dict[str, Any]:
    with sync_status_lock:
        return dict(long_term_sync_status)


def get_short_term_sync_status() -> dict[str, Any]:
    with sync_status_lock:
        return dict(short_term_sync_status)


def run_due_syncs(force_long_term: bool = False, force_short_term: bool = False) -> dict[str, Any]:
    long_term = run_long_term_sync(force=force_long_term)
    short_term = run_short_term_sync(force=force_short_term)
    return {
        "long_term": long_term,
        "short_term": short_term,
        "refreshed_at": iso_now(),
    }


def auto_refresh_loop() -> None:
    while not refresh_stop_event.wait(COORDINATOR_POLL_INTERVAL_SECONDS):
        try:
            run_due_syncs()
        except Exception:
            continue


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    global refresh_thread
    init_db()
    if refresh_thread is None or not refresh_thread.is_alive():
        refresh_stop_event.clear()
        refresh_thread = threading.Thread(target=auto_refresh_loop, name="sync-coordinator", daemon=True)
        refresh_thread.start()
    threading.Thread(target=run_due_syncs, name="startup-sync", daemon=True).start()

    try:
        yield
    finally:
        refresh_stop_event.set()


@asynccontextmanager
async def app_lifespan_no_background(_: FastAPI):
    init_db()
    yield


def create_app(enable_background_sync: bool = True) -> FastAPI:
    lifespan_handler = app_lifespan if enable_background_sync else app_lifespan_no_background
    app = FastAPI(title=APP_NAME, lifespan=lifespan_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.app_name = APP_NAME
    app.state.db_path = DB_PATH
    app.state.primary_campus_id = PRIMARY_CAMPUS_ID
    app.state.run_long_term_sync = run_long_term_sync
    app.state.run_short_term_sync = run_short_term_sync
    app.state.run_due_syncs = run_due_syncs
    app.state.get_last_successful_refresh = get_last_successful_refresh
    app.state.is_long_term_sync_running = is_long_term_sync_running
    app.state.is_short_term_sync_running = is_short_term_sync_running
    app.state.get_long_term_sync_status = get_long_term_sync_status
    app.state.get_short_term_sync_status = get_short_term_sync_status
    app.include_router(create_router())

    return app


app = create_app()