from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Callable

from sync_support import ApiRateLimiter, fetch_paginated_records, fetch_single_record


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_campus_payload(campus_payload: dict[str, Any]) -> dict[str, Any]:
    required = ("id", "name", "city", "country", "users_count")
    if not all(key in campus_payload for key in required):
        raise RuntimeError("Campus payload missing required fields")
    return {
        "id": int(campus_payload["id"]),
        "name": str(campus_payload["name"]),
        "city": str(campus_payload.get("city", "")),
        "country": str(campus_payload.get("country", "")),
        "users_count": int(campus_payload["users_count"]),
    }


def normalize_coalitions_payload(blocs_payload: list[dict[str, Any]], campus_id: int) -> list[dict[str, Any]]:
    coalitions_by_id: dict[int, dict[str, Any]] = {}

    for bloc in blocs_payload:
        bloc_campus_id = bloc.get("campus_id")
        cursus_id = bloc.get("cursus_id")
        for coalition in bloc.get("coalitions", []):
            coalition_id = coalition.get("id")
            name = coalition.get("name")
            if coalition_id is None or name is None:
                continue
            coalitions_by_id[int(coalition_id)] = {
                "coalition_id": int(coalition_id),
                "campus_id": int(bloc_campus_id) if bloc_campus_id is not None else campus_id,
                "cursus_id": int(cursus_id) if cursus_id is not None else None,
                "coalition_name": str(name),
                "slug": str(coalition.get("slug", "")),
                "image_url": str(coalition.get("image_url", "")),
                "cover_url": str(coalition.get("cover_url", "")),
                "color": str(coalition.get("color", "")),
            }

    return list(coalitions_by_id.values())


def normalize_users_payload(
    campus_id: int,
    users_payload: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []

    for item in users_payload:
        user_id = item.get("id")
        login = item.get("login")
        if user_id is None or login is None:
            continue

        image_payload = item.get("image")
        login_value = str(login)

        normalized.append(
            {
                "user_id": int(user_id),
                "campus_id": campus_id,
                "login": login_value,
                "first_name": str(item.get("first_name", "")),
                "last_name": str(item.get("last_name", "")),
                "url": str(item.get("url", "")),
                "kind": str(item.get("kind", "")),
                "image": json.dumps(image_payload, ensure_ascii=False) if image_payload is not None else "null",
                "pool_month": str(item.get("pool_month", "")),
                "pool_year": str(item.get("pool_year", "")),
                "active": int(bool(item.get("active?", False))),
                "alumni": int(bool(item.get("alumni?", False))),
                "is_staff": int(bool(item.get("staff?", False))),
                "is_alumni": int(bool(item.get("alumni?", False))),
                "is_active": int(bool(item.get("active?", False))),
                "achievements_count": 0,
            }
        )

    return normalized


def upsert_campus_snapshot(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)
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


def upsert_coalitions(db_path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    last_seen_at = iso_now()
    conn = sqlite3.connect(db_path)

    for row in rows:
        conn.execute(
            """
            INSERT INTO coalition_reference (
                coalition_id,
                campus_id,
                cursus_id,
                coalition_name,
                slug,
                image_url,
                cover_url,
                color,
                last_seen_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(coalition_id) DO UPDATE SET
                campus_id=excluded.campus_id,
                cursus_id=excluded.cursus_id,
                coalition_name=excluded.coalition_name,
                slug=excluded.slug,
                image_url=excluded.image_url,
                cover_url=excluded.cover_url,
                color=excluded.color,
                last_seen_at=excluded.last_seen_at
            """,
            (
                row["coalition_id"],
                row["campus_id"],
                row["cursus_id"],
                row["coalition_name"],
                row["slug"],
                row["image_url"],
                row["cover_url"],
                row["color"],
                last_seen_at,
            ),
        )

    conn.commit()
    conn.close()


def upsert_campus_users(db_path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    last_seen_at = iso_now()
    conn = sqlite3.connect(db_path)

    for row in rows:
        conn.execute(
            """
            INSERT INTO campus_user (
                user_id,
                campus_id,
                login,
                first_name,
                last_name,
                url,
                kind,
                image,
                pool_month,
                pool_year,
                active,
                alumni,
                is_staff,
                is_alumni,
                is_active,
                achievements_count,
                last_seen_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                campus_id=excluded.campus_id,
                login=excluded.login,
                first_name=excluded.first_name,
                last_name=excluded.last_name,
                url=excluded.url,
                kind=excluded.kind,
                image=excluded.image,
                pool_month=excluded.pool_month,
                pool_year=excluded.pool_year,
                active=excluded.active,
                alumni=excluded.alumni,
                is_staff=excluded.is_staff,
                is_alumni=excluded.is_alumni,
                is_active=excluded.is_active,
                achievements_count=excluded.achievements_count,
                last_seen_at=excluded.last_seen_at
            """,
            (
                row["user_id"],
                row["campus_id"],
                row["login"],
                row["first_name"],
                row["last_name"],
                row["url"],
                row["kind"],
                row["image"],
                row["pool_month"],
                row["pool_year"],
                row["active"],
                row["alumni"],
                row["is_staff"],
                row["is_alumni"],
                row["is_active"],
                row["achievements_count"],
                last_seen_at,
            ),
        )

    conn.commit()
    conn.close()


def prune_old_snapshots(db_path: Path, days: int = 365) -> None:
    cutoff_value = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM campus_metrics_snapshot WHERE collected_at < ?", (cutoff_value,))
    conn.commit()
    conn.close()


def sync_long_term_data(
    db_path: Path,
    config_path: Path,
    campus_id: int,
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    limiter = ApiRateLimiter(max_per_second=2, max_per_hour=900)

    if progress_callback is not None:
        progress_callback({"stage": "fetch_campus"})
    campus_payload = fetch_single_record(config_path, f"/campus/{campus_id}", limiter=limiter)
    campus_row = normalize_campus_payload(campus_payload)

    if progress_callback is not None:
        progress_callback({"stage": "fetch_coalitions"})
    blocs_payload = fetch_paginated_records(
        config_path,
        "/blocs",
        params={"filter[campus_id]": campus_id},
        limiter=limiter,
    )
    coalition_rows = normalize_coalitions_payload(blocs_payload, campus_id=campus_id)

    if progress_callback is not None:
        progress_callback({"stage": "fetch_campus_users"})
    users_payload = fetch_paginated_records(
        config_path,
        f"/campus/{campus_id}/users",
        limiter=limiter,
    )
    user_rows = normalize_users_payload(campus_id, users_payload)

    if progress_callback is not None:
        progress_callback({"stage": "persist_cache"})
    upsert_campus_snapshot(db_path, [campus_row], source_status="live_api")
    upsert_coalitions(db_path, coalition_rows)
    upsert_campus_users(db_path, user_rows)
    prune_old_snapshots(db_path)

    return {
        "campus_id": campus_id,
        "inserted_campuses": 1,
        "coalitions_count": len(coalition_rows),
        "users_count": len(user_rows),
    }