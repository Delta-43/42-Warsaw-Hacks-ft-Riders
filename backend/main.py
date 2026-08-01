from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
import threading
from typing import Any

from api42lib import IntraAPIClient
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


APP_NAME = "42 Warsaw Campus Dashboard API"
CACHE_TTL_SECONDS = 600
AUTO_REFRESH_SECONDS = 600

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "dashboard_cache.db"

FALLBACK_PATHS = [
    DATA_DIR / "campus.json",
    Path(__file__).resolve().parent.parent / "data" / "campus.json",
]

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

    conn.commit()
    conn.close()


def get_client() -> IntraAPIClient:
    return IntraAPIClient(config_path="config.yml")


def normalize_campus_payload(campus_payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in campus_payload:
        if not all(k in item for k in ("id", "name", "city", "country", "users_count")):
            continue
        normalized.append(
            {
                "id": int(item["id"]),
                "name": str(item["name"]),
                "city": str(item.get("city", "")),
                "country": str(item.get("country", "")),
                "users_count": int(item["users_count"]),
            }
        )
    return normalized


def write_seed_files(campus_payload: list[dict[str, Any]]) -> None:
    full_path = DATA_DIR / "full_campus.json"
    with full_path.open("w", encoding="utf-8") as fh:
        json.dump(campus_payload, fh, indent=2, ensure_ascii=False)

    compact = normalize_campus_payload(campus_payload)
    compact_path = DATA_DIR / "campus.json"
    with compact_path.open("w", encoding="utf-8") as fh:
        json.dump(compact, fh, indent=2, ensure_ascii=False)


def load_json_fallback() -> list[dict[str, Any]]:
    for path in FALLBACK_PATHS:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        if isinstance(payload, list):
            return normalize_campus_payload(payload)
    return []


def log_refresh(started_at: str, success: bool, error_summary: str | None = None) -> None:
    finished_at = iso_now()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT INTO refresh_log (job_name, started_at, finished_at, success, error_summary)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("campus_refresh", started_at, finished_at, int(success), error_summary),
    )
    conn.commit()
    conn.close()


def upsert_campus_snapshot(rows: list[dict[str, Any]], source_status: str) -> None:
    collected_at = iso_now()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=ON;")

    for row in rows:
        conn.execute(
            """
            INSERT INTO campus_reference (campus_id, campus_name, city, country, last_seen_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(campus_id) DO UPDATE SET
                campus_name=excluded.campus_name,
                city=excluded.city,
                country=excluded.country,
                last_seen_at=excluded.last_seen_at
            """,
            (row["id"], row["name"], row["city"], row["country"], collected_at),
        )
        conn.execute(
            """
            INSERT INTO campus_metrics_snapshot (campus_id, users_count, collected_at, source_status)
            VALUES (?, ?, ?, ?)
            """,
            (row["id"], row["users_count"], collected_at, source_status),
        )

    conn.commit()
    conn.close()


def prune_old_snapshots(days: int = 180) -> None:
    cutoff = (utcnow() - timedelta(days=days)).isoformat()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "DELETE FROM campus_metrics_snapshot WHERE collected_at < ?",
        (cutoff,),
    )
    conn.commit()
    conn.close()


def fetch_campus_from_api() -> list[dict[str, Any]]:
    client = get_client()
    response = client.get("/campus")
    if response.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail=f"Upstream 42 API failed with status {response.status_code}",
        )
    payload = response.json()
    if not isinstance(payload, list):
        raise HTTPException(status_code=503, detail="Unexpected campus payload shape")
    return normalize_campus_payload(payload)


def refresh_cache_from_api() -> dict[str, Any]:
    started = iso_now()
    try:
        campus_rows = fetch_campus_from_api()
        upsert_campus_snapshot(campus_rows, source_status="live_api")
        prune_old_snapshots()
        write_seed_files(campus_rows)
        log_refresh(started, success=True)
        return {
            "success": True,
            "source_mode": "refreshed",
            "inserted_campuses": len(campus_rows),
            "refreshed_at": iso_now(),
        }
    except Exception as exc:  # defensive logging for upstream/downstream failures
        log_refresh(started, success=False, error_summary=str(exc))
        raise


def get_latest_snapshot() -> tuple[list[dict[str, Any]], datetime | None]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    latest_row = conn.execute(
        "SELECT MAX(collected_at) AS latest FROM campus_metrics_snapshot"
    ).fetchone()

    latest = latest_row["latest"] if latest_row else None
    if latest is None:
        conn.close()
        return [], None

    rows = conn.execute(
        """
        SELECT
            ref.campus_id AS id,
            ref.campus_name AS name,
            ref.city AS city,
            ref.country AS country,
            snap.users_count AS users_count,
            snap.collected_at AS collected_at,
            snap.source_status AS source_status
        FROM campus_metrics_snapshot snap
        JOIN campus_reference ref ON ref.campus_id = snap.campus_id
        WHERE snap.collected_at = ?
        ORDER BY snap.users_count DESC
        """,
        (latest,),
    ).fetchall()
    conn.close()

    snapshot = [dict(row) for row in rows]
    parsed = parse_iso_datetime(latest)
    return snapshot, parsed


def get_snapshot_by_timestamp(collected_at: str) -> list[dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT
            ref.campus_id AS id,
            ref.campus_name AS name,
            ref.city AS city,
            ref.country AS country,
            snap.users_count AS users_count,
            snap.collected_at AS collected_at,
            snap.source_status AS source_status
        FROM campus_metrics_snapshot snap
        JOIN campus_reference ref ON ref.campus_id = snap.campus_id
        WHERE snap.collected_at = ?
        ORDER BY snap.users_count DESC
        """,
        (collected_at,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_recent_snapshot_timestamps(limit: int = 2) -> list[str]:
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        """
        SELECT DISTINCT collected_at
        FROM campus_metrics_snapshot
        ORDER BY collected_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [row[0] for row in rows]


def ensure_seed_cache() -> bool:
    snapshot, _ = get_latest_snapshot()
    if snapshot:
        return True

    fallback_rows = load_json_fallback()
    if not fallback_rows:
        return False

    upsert_campus_snapshot(fallback_rows, source_status="fallback_file")
    return True


def get_campus_data(force_refresh: bool = False) -> dict[str, Any]:
    snapshot, collected_at = get_latest_snapshot()
    now = utcnow()

    if force_refresh:
        result = refresh_cache_from_api()
        snapshot, collected_at = get_latest_snapshot()
        return {
            "source_mode": result["source_mode"],
            "cache_age_seconds": 0,
            "data_timestamp": collected_at.isoformat() if collected_at else None,
            "items": snapshot,
        }

    is_fresh = False
    if collected_at:
        age = (now - collected_at).total_seconds()
        is_fresh = age <= CACHE_TTL_SECONDS
    else:
        age = None

    if is_fresh and snapshot:
        return {
            "source_mode": "fresh_cache",
            "cache_age_seconds": int(age) if age is not None else None,
            "data_timestamp": collected_at.isoformat() if collected_at else None,
            "items": snapshot,
        }

    try:
        refresh_cache_from_api()
        snapshot, collected_at = get_latest_snapshot()
        return {
            "source_mode": "refreshed",
            "cache_age_seconds": 0,
            "data_timestamp": collected_at.isoformat() if collected_at else None,
            "items": snapshot,
        }
    except Exception:
        if snapshot:
            stale_age = int((now - collected_at).total_seconds()) if collected_at else None
            return {
                "source_mode": "stale_fallback",
                "cache_age_seconds": stale_age,
                "data_timestamp": collected_at.isoformat() if collected_at else None,
                "items": snapshot,
            }
        raise HTTPException(
            status_code=503,
            detail="No cached campus data available and upstream API is unreachable",
        )


def get_campus_item(campus_id: int, force_refresh: bool = False) -> dict[str, Any]:
    payload = get_campus_data(force_refresh=force_refresh)
    for item in payload["items"]:
        if item["id"] == campus_id:
            return {
                "source_mode": payload["source_mode"],
                "cache_age_seconds": payload["cache_age_seconds"],
                "data_timestamp": payload["data_timestamp"],
                "campus": item,
            }
    raise HTTPException(status_code=404, detail=f"Campus {campus_id} not found in cache")


def get_campus_history(campus_id: int, points: int = 30) -> dict[str, Any]:
    if points < 1 or points > 1000:
        raise HTTPException(status_code=400, detail="points must be between 1 and 1000")

    payload = get_campus_data(force_refresh=False)
    campus_name = None
    for item in payload["items"]:
        if item["id"] == campus_id:
            campus_name = item["name"]
            break

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT users_count, collected_at, source_status
        FROM campus_metrics_snapshot
        WHERE campus_id = ?
        ORDER BY collected_at DESC
        LIMIT ?
        """,
        (campus_id, points),
    ).fetchall()
    conn.close()

    history_desc = [dict(row) for row in rows]
    history = list(reversed(history_desc))

    if campus_name is None and history:
        campus_name = f"Campus {campus_id}"

    if not history:
        raise HTTPException(status_code=404, detail=f"No history found for campus {campus_id}")

    return {
        "source_mode": payload["source_mode"],
        "cache_age_seconds": payload["cache_age_seconds"],
        "data_timestamp": payload["data_timestamp"],
        "campus": {"id": campus_id, "name": campus_name},
        "points": len(history),
        "history": history,
    }


def build_highlights(campus_items: list[dict[str, Any]], top_n: int = 5) -> dict[str, Any]:
    top_n = max(1, min(top_n, 20))
    latest_top = campus_items[:top_n]

    timestamps = get_recent_snapshot_timestamps(limit=2)
    growth_map: dict[int, int] = {}
    previous_ts = timestamps[1] if len(timestamps) > 1 else None

    if previous_ts:
        previous_snapshot = get_snapshot_by_timestamp(previous_ts)
        previous_by_id = {item["id"]: item for item in previous_snapshot}
        for item in latest_top:
            prev = previous_by_id.get(item["id"])
            growth_map[item["id"]] = item["users_count"] - prev["users_count"] if prev else 0
    else:
        for item in latest_top:
            growth_map[item["id"]] = 0

    highlight_cards = []
    for item in latest_top:
        highlight_cards.append(
            {
                "id": item["id"],
                "name": item["name"],
                "city": item["city"],
                "country": item["country"],
                "users_count": item["users_count"],
                "users_delta_since_prev": growth_map[item["id"]],
            }
        )

    return {
        "top_count": top_n,
        "items": highlight_cards,
    }


def auto_refresh_loop() -> None:
    while not refresh_stop_event.wait(AUTO_REFRESH_SECONDS):
        try:
            refresh_cache_from_api()
        except Exception:
            # Keep loop alive even when upstream API is unavailable.
            continue


def build_summary(campus_items: list[dict[str, Any]]) -> dict[str, Any]:
    total_campuses = len(campus_items)
    total_users = sum(item["users_count"] for item in campus_items)
    top = campus_items[0] if campus_items else None
    return {
        "total_campuses": total_campuses,
        "total_users": total_users,
        "top_campus": {
            "id": top["id"],
            "name": top["name"],
            "users_count": top["users_count"],
        }
        if top
        else None,
    }


app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    global refresh_thread
    init_db()
    ensure_seed_cache()
    if refresh_thread is None or not refresh_thread.is_alive():
        refresh_stop_event.clear()
        refresh_thread = threading.Thread(target=auto_refresh_loop, name="auto-refresh", daemon=True)
        refresh_thread.start()


@app.on_event("shutdown")
def shutdown() -> None:
    refresh_stop_event.set()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": APP_NAME, "time": iso_now()}


@app.get("/api/v1/campus")
def campus(force_refresh: bool = Query(default=False)) -> dict[str, Any]:
    payload = get_campus_data(force_refresh=force_refresh)
    return payload


@app.get("/api/v1/campus/{campus_id}")
def campus_by_id(campus_id: int, force_refresh: bool = Query(default=False)) -> dict[str, Any]:
    return get_campus_item(campus_id=campus_id, force_refresh=force_refresh)


@app.get("/api/v1/campus/{campus_id}/history")
def campus_history(campus_id: int, points: int = Query(default=30, ge=1, le=1000)) -> dict[str, Any]:
    return get_campus_history(campus_id=campus_id, points=points)


@app.get("/api/v1/summary")
def summary(force_refresh: bool = Query(default=False)) -> dict[str, Any]:
    payload = get_campus_data(force_refresh=force_refresh)
    summary_payload = build_summary(payload["items"])
    return {
        "source_mode": payload["source_mode"],
        "cache_age_seconds": payload["cache_age_seconds"],
        "data_timestamp": payload["data_timestamp"],
        "summary": summary_payload,
    }


@app.get("/api/v1/highlights")
def highlights(
    force_refresh: bool = Query(default=False),
    top_n: int = Query(default=5, ge=1, le=20),
) -> dict[str, Any]:
    payload = get_campus_data(force_refresh=force_refresh)
    highlight_payload = build_highlights(payload["items"], top_n=top_n)
    return {
        "source_mode": payload["source_mode"],
        "cache_age_seconds": payload["cache_age_seconds"],
        "data_timestamp": payload["data_timestamp"],
        "highlights": highlight_payload,
    }


@app.post("/api/v1/refresh")
def refresh() -> dict[str, Any]:
    return refresh_cache_from_api()