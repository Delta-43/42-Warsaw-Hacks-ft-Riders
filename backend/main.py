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
    if not should_run("long_term_sync", LONG_TERM_SYNC_INTERVAL, force=force):
        return {
            "job_name": "long_term_sync",
            "ran": False,
            "source_mode": "fresh_cache",
        }

    started_at = iso_now()
    try:
        result = sync_long_term_data(
            db_path=DB_PATH,
            config_path=CONFIG_PATH,
            campus_id=PRIMARY_CAMPUS_ID,
        )
        log_refresh("long_term_sync", started_at, success=True)
        return {
            "job_name": "long_term_sync",
            "ran": True,
            "source_mode": "refreshed",
            **result,
        }
    except Exception as exc:
        log_refresh("long_term_sync", started_at, success=False, error_summary=str(exc))
        raise


def run_short_term_sync(force: bool = False) -> dict[str, Any]:
    if not should_run("short_term_sync", SHORT_TERM_SYNC_INTERVAL, force=force):
        return {
            "job_name": "short_term_sync",
            "ran": False,
            "source_mode": "fresh_cache",
        }

    started_at = iso_now()
    try:
        result = sync_short_term_data(
            db_path=DB_PATH,
            config_path=CONFIG_PATH,
            campus_id=PRIMARY_CAMPUS_ID,
        )
        log_refresh("short_term_sync", started_at, success=True)
        return {
            "job_name": "short_term_sync",
            "ran": True,
            "source_mode": "refreshed",
            **result,
        }
    except Exception as exc:
        log_refresh("short_term_sync", started_at, success=False, error_summary=str(exc))
        raise


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


def create_app() -> FastAPI:
    app = FastAPI(title=APP_NAME)

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
    app.include_router(create_router())

    @app.on_event("startup")
    def startup() -> None:
        global refresh_thread
        init_db()
        if refresh_thread is None or not refresh_thread.is_alive():
            refresh_stop_event.clear()
            refresh_thread = threading.Thread(target=auto_refresh_loop, name="sync-coordinator", daemon=True)
            refresh_thread.start()
        threading.Thread(target=run_due_syncs, name="startup-sync", daemon=True).start()

    @app.on_event("shutdown")
    def shutdown() -> None:
        refresh_stop_event.set()

    return app


app = create_app()