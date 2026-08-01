from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any

from api42lib import IntraAPIClient


API_PAGE_SIZE = 100


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_client(config_path: Path) -> IntraAPIClient:
    return IntraAPIClient(config_path=str(config_path))


def fetch_paginated_records(
    config_path: Path,
    endpoint: str,
    params: dict[str, Any] | None = None,
    page_size: int = API_PAGE_SIZE,
) -> list[dict[str, Any]]:
    client = get_client(config_path)
    page_number = 1
    records: list[dict[str, Any]] = []
    base_params = dict(params or {})

    while True:
        request_params = {
            **base_params,
            "page[number]": page_number,
            "page[size]": page_size,
        }
        response = client.get(endpoint, params=request_params)
        if response.status_code != 200:
            raise RuntimeError(f"Request failed for {endpoint}: {response.status_code}")

        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError(f"Unexpected payload shape for {endpoint}")

        records.extend(payload)
        if len(payload) < page_size:
            break
        page_number += 1

    return records


def fetch_single_record(config_path: Path, endpoint: str) -> dict[str, Any]:
    client = get_client(config_path)
    response = client.get(endpoint)
    if response.status_code != 200:
        raise RuntimeError(f"Request failed for {endpoint}: {response.status_code}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected payload shape for {endpoint}")
    return payload


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


def normalize_achievements_payload(
    campus_id: int,
    achievements_payload: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in achievements_payload:
        achievement_id = item.get("id")
        name = item.get("name")
        if achievement_id is None or name is None:
            continue
        normalized.append(
            {
                "achievement_id": int(achievement_id),
                "campus_id": campus_id,
                "name": str(name),
                "description": str(item.get("description", "")),
                "tier": str(item.get("tier", "")),
                "kind": str(item.get("kind", "")),
                "visible": int(bool(item.get("visible", False))),
                "nbr_of_success": int(item["nbr_of_success"]) if item.get("nbr_of_success") is not None else None,
            }
        )
    return normalized


def compute_achievement_analytics(
    config_path: Path,
    campus_user_rows: list[dict[str, Any]],
    achievement_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[int, int]]:
    campus_user_ids = {int(row["user_id"]) for row in campus_user_rows}
    login_to_user_id = {
        str(row["login"]): int(row["user_id"])
        for row in campus_user_rows
        if row.get("login")
    }

    per_user_counts: dict[int, int] = {int(row["user_id"]): 0 for row in campus_user_rows}
    per_achievement_counts: list[dict[str, Any]] = []

    for achievement in achievement_rows:
        achievement_id = int(achievement["achievement_id"])
        entries = fetch_paginated_records(config_path, f"/achievements/{achievement_id}/achievements_users")
        matched_users: set[int] = set()

        for entry in entries:
            entry_user_id = entry.get("user_id")
            entry_login = entry.get("login")

            if entry_user_id is not None:
                user_id_value = int(entry_user_id)
                if user_id_value in campus_user_ids:
                    matched_users.add(user_id_value)
                    continue

            if entry_login is not None:
                login_value = str(entry_login)
                user_id_value = login_to_user_id.get(login_value)
                if user_id_value is not None:
                    matched_users.add(user_id_value)

        for user_id in matched_users:
            per_user_counts[user_id] = per_user_counts.get(user_id, 0) + 1

        per_achievement_counts.append(
            {
                "achievement_id": achievement_id,
                "users_count": len(matched_users),
            }
        )

    return per_achievement_counts, per_user_counts


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


def upsert_achievements(db_path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    last_seen_at = iso_now()
    conn = sqlite3.connect(db_path)

    for row in rows:
        conn.execute(
            """
            INSERT INTO achievement_reference (
                achievement_id,
                campus_id,
                name,
                description,
                tier,
                kind,
                visible,
                nbr_of_success,
                last_seen_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(achievement_id) DO UPDATE SET
                campus_id=excluded.campus_id,
                name=excluded.name,
                description=excluded.description,
                tier=excluded.tier,
                kind=excluded.kind,
                visible=excluded.visible,
                nbr_of_success=excluded.nbr_of_success,
                last_seen_at=excluded.last_seen_at
            """,
            (
                row["achievement_id"],
                row["campus_id"],
                row["name"],
                row["description"],
                row["tier"],
                row["kind"],
                row["visible"],
                row["nbr_of_success"],
                last_seen_at,
            ),
        )

    conn.commit()
    conn.close()


def upsert_achievement_metrics(db_path: Path, campus_id: int, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)

    for row in rows:
        conn.execute(
            """
            INSERT INTO achievement_metric_snapshot (
                campus_id,
                achievement_id,
                users_count,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (campus_id, row["achievement_id"], row["users_count"], collected_at, source_status),
        )

    conn.commit()
    conn.close()


def upsert_user_achievement_counts(db_path: Path, campus_id: int, counts: dict[int, int]) -> None:
    if not counts:
        return

    conn = sqlite3.connect(db_path)
    for user_id, achievements_count in counts.items():
        conn.execute(
            """
            UPDATE campus_user
            SET achievements_count = ?,
                last_seen_at = ?
            WHERE campus_id = ? AND user_id = ?
            """,
            (int(achievements_count), iso_now(), campus_id, int(user_id)),
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
) -> dict[str, Any]:
    campus_payload = fetch_single_record(config_path, f"/campus/{campus_id}")
    campus_row = normalize_campus_payload(campus_payload)
    blocs_payload = fetch_paginated_records(config_path, "/blocs", params={"filter[campus_id]": campus_id})
    coalition_rows = normalize_coalitions_payload(blocs_payload, campus_id=campus_id)
    users_payload = fetch_paginated_records(config_path, f"/campus/{campus_id}/users")
    user_rows = normalize_users_payload(campus_id, users_payload)
    achievements_payload = fetch_paginated_records(config_path, f"/campus/{campus_id}/achievements")
    achievement_rows = normalize_achievements_payload(campus_id, achievements_payload)
    achievement_metrics, user_achievement_counts = compute_achievement_analytics(
        config_path=config_path,
        campus_user_rows=user_rows,
        achievement_rows=achievement_rows,
    )

    upsert_campus_snapshot(db_path, [campus_row], source_status="live_api")
    upsert_coalitions(db_path, coalition_rows)
    upsert_campus_users(db_path, user_rows)
    upsert_achievements(db_path, achievement_rows)
    upsert_achievement_metrics(db_path, campus_id, achievement_metrics, source_status="live_api")
    upsert_user_achievement_counts(db_path, campus_id, user_achievement_counts)
    prune_old_snapshots(db_path)

    return {
        "campus_id": campus_id,
        "inserted_campuses": 1,
        "coalitions_count": len(coalition_rows),
        "users_count": len(user_rows),
        "achievements_count": len(achievement_rows),
    }