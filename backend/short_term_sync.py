import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3
from typing import Any

from sync_support import (
    ApiBudgetExceeded,
    ApiRateLimiter,
    fetch_paginated_records,
    get_client,
    get_sync_cursor,
    parse_api_datetime,
    parse_iso_datetime,
    set_sync_cursor,
)


WEEKLY_SYNC_JOB = "short_term_weekly"
DAILY_SYNC_JOB = "short_term_daily"


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_coalition_scores(blocs_payload: list[dict[str, Any]], campus_id: int) -> list[dict[str, Any]]:
    scores: list[dict[str, Any]] = []
    for bloc in blocs_payload:
        bloc_campus_id = int(bloc.get("campus_id") or campus_id)
        for coalition in bloc.get("coalitions", []):
            coalition_id = coalition.get("id")
            score = coalition.get("score")
            if coalition_id is None or score is None:
                continue
            scores.append(
                {
                    "coalition_id": int(coalition_id),
                    "campus_id": bloc_campus_id,
                    "score": int(score),
                }
            )
    return scores


def normalize_coalition_user_scores(payload: list[dict[str, Any]], campus_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in payload:
        coalition_id = item.get("coalition_id")
        user_id = item.get("user_id")
        score = item.get("score")
        if coalition_id is None or user_id is None or score is None:
            continue
        rank_value = item.get("rank")
        rows.append(
            {
                "campus_id": campus_id,
                "coalition_id": int(coalition_id),
                "user_id": int(user_id),
                "score": int(score),
                "rank": int(rank_value) if rank_value is not None else None,
            }
        )
    return rows


def normalize_project_activity(payload: list[dict[str, Any]], campus_id: int, activity_type: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in payload:
        user = item.get("user") or {}
        project = item.get("project") or {}
        user_id = user.get("id")
        project_id = project.get("id")
        project_name = project.get("name")
        projects_user_id = item.get("id")
        activity_at = item.get("created_at") if activity_type == "created" else item.get("updated_at")

        if user_id is None or project_id is None or project_name is None or activity_at is None:
            continue

        rows.append(
            {
                "campus_id": campus_id,
                "user_id": int(user_id),
                "project_id": int(project_id),
                "project_name": str(project_name),
                "projects_user_id": int(projects_user_id) if projects_user_id is not None else None,
                "activity_type": activity_type,
                "activity_at": str(activity_at),
            }
        )

    return rows


def normalize_project_passes(payload: list[dict[str, Any]], campus_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in payload:
        marked_at = item.get("marked_at")
        user = item.get("user") or {}
        project = item.get("project") or {}
        user_id = user.get("id")
        project_id = project.get("id")
        project_name = project.get("name")

        if marked_at is None or user_id is None or project_id is None or project_name is None:
            continue

        image = user.get("image") or {}
        image_link = image.get("link") if isinstance(image, dict) else None

        rows.append(
            {
                "campus_id": campus_id,
                "user_id": int(user_id),
                "project_id": int(project_id),
                "project_name": str(project_name),
                "projects_user_id": int(item["id"]) if item.get("id") is not None else None,
                "marked_at": str(marked_at),
                "user_login": str(user.get("login", "")),
                "user_image_url": str(image_link or ""),
                "user_profile_url": str(user.get("url", "")),
            }
        )

    return rows


def normalize_locations(payload: list[dict[str, Any]], campus_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in payload:
        user = item.get("user") or {}
        user_id = user.get("id")
        begin_at = item.get("begin_at")
        if user_id is None or begin_at is None:
            continue

        rows.append(
            {
                "campus_id": campus_id,
                "user_id": int(user_id),
                "begin_at": str(begin_at),
                "end_at": str(item["end_at"]) if item.get("end_at") is not None else None,
                "host": str(item.get("host", "")),
            }
        )

    return rows


def normalize_cursus_users(payload: list[dict[str, Any]], campus_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in payload:
        user = item.get("user") or {}
        cursus = item.get("cursus") or {}
        user_id = user.get("id")
        cursus_id = item.get("cursus_id")
        if user_id is None or cursus_id is None:
            continue

        rows.append(
            {
                "campus_id": campus_id,
                "user_id": int(user_id),
                "cursus_id": int(cursus_id),
                "cursus_name": str(cursus.get("name", "")),
                "is_active": 1,
            }
        )

    return rows


def upsert_coalition_score_snapshot(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)

    for row in rows:
        conn.execute(
            """
            INSERT INTO coalition_score_snapshot (
                coalition_id,
                campus_id,
                score,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (row["coalition_id"], row["campus_id"], row["score"], collected_at, source_status),
        )

    conn.commit()
    conn.close()


def insert_coalition_user_scores(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)

    for row in rows:
        conn.execute(
            """
            INSERT INTO coalition_user_score_snapshot (
                campus_id,
                coalition_id,
                user_id,
                score,
                rank,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["campus_id"],
                row["coalition_id"],
                row["user_id"],
                row["score"],
                row["rank"],
                collected_at,
                source_status,
            ),
        )

    conn.commit()
    conn.close()


def insert_project_activity_events(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)
    for row in rows:
        conn.execute(
            """
            INSERT OR IGNORE INTO project_activity_event (
                campus_id,
                user_id,
                project_id,
                project_name,
                projects_user_id,
                activity_type,
                activity_at,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["campus_id"],
                row["user_id"],
                row["project_id"],
                row["project_name"],
                row["projects_user_id"],
                row["activity_type"],
                row["activity_at"],
                collected_at,
                source_status,
            ),
        )

    conn.commit()
    conn.close()


def insert_project_pass_events(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)
    for row in rows:
        conn.execute(
            """
            INSERT OR IGNORE INTO project_pass_event (
                campus_id,
                user_id,
                project_id,
                project_name,
                projects_user_id,
                marked_at,
                user_login,
                user_image_url,
                user_profile_url,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["campus_id"],
                row["user_id"],
                row["project_id"],
                row["project_name"],
                row["projects_user_id"],
                row["marked_at"],
                row["user_login"],
                row["user_image_url"],
                row["user_profile_url"],
                collected_at,
                source_status,
            ),
        )

    conn.commit()
    conn.close()


def insert_location_events(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)
    for row in rows:
        conn.execute(
            """
            INSERT OR IGNORE INTO location_event (
                campus_id,
                user_id,
                begin_at,
                end_at,
                host,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["campus_id"],
                row["user_id"],
                row["begin_at"],
                row["end_at"],
                row["host"],
                collected_at,
                source_status,
            ),
        )

    conn.commit()
    conn.close()


def insert_cursus_user_snapshot(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)
    for row in rows:
        conn.execute(
            """
            INSERT INTO cursus_user_snapshot (
                campus_id,
                user_id,
                cursus_id,
                cursus_name,
                is_active,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["campus_id"],
                row["user_id"],
                row["cursus_id"],
                row["cursus_name"],
                row["is_active"],
                collected_at,
                source_status,
            ),
        )

    conn.commit()
    conn.close()


def insert_short_term_metric_snapshot(
    db_path: Path,
    campus_id: int,
    metric_name: str,
    metric_value: float | int | None,
    payload: dict[str, Any] | None,
    source_status: str,
) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO short_term_metric_snapshot (
            campus_id,
            metric_name,
            metric_value,
            payload_json,
            collected_at,
            source_status
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            campus_id,
            metric_name,
            float(metric_value) if metric_value is not None else None,
            json.dumps(payload, ensure_ascii=False) if payload is not None else None,
            iso_now(),
            source_status,
        ),
    )
    conn.commit()
    conn.close()


def get_campus_user_id_bounds(db_path: Path, campus_id: int) -> tuple[int | None, int | None, set[int]]:
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        """
        SELECT user_id
        FROM campus_user
        WHERE campus_id = ?
        ORDER BY user_id ASC
        """,
        (campus_id,),
    ).fetchall()
    conn.close()

    user_ids = [int(row[0]) for row in rows]
    if not user_ids:
        return None, None, set()
    return user_ids[0], user_ids[-1], set(user_ids)


def count_weekly_achievements_earned(payload: list[dict[str, Any]], campus_user_ids: set[int]) -> int:
    total = 0
    for item in payload:
        user_id = item.get("user_id")
        if user_id is None:
            user = item.get("user") or {}
            user_id = user.get("id")
        if user_id is None:
            continue
        if int(user_id) in campus_user_ids:
            total += 1
    return total


def upsert_weekly_user_logtime(
    db_path: Path,
    campus_id: int,
    week_start_date: str,
    rows: list[dict[str, Any]],
    source_status: str,
) -> None:
    collected_at = iso_now()
    conn = sqlite3.connect(db_path)
    for row in rows:
        conn.execute(
            """
            INSERT INTO weekly_user_logtime (
                campus_id,
                user_id,
                week_start_date,
                seconds_logged,
                sessions_count,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(campus_id, user_id, week_start_date) DO UPDATE SET
                seconds_logged = excluded.seconds_logged,
                sessions_count = excluded.sessions_count,
                collected_at = excluded.collected_at,
                source_status = excluded.source_status
            """,
            (
                campus_id,
                row["user_id"],
                week_start_date,
                row["seconds_logged"],
                row["sessions_count"],
                collected_at,
                source_status,
            ),
        )
    conn.commit()
    conn.close()


def upsert_weekly_campus_attendance(
    db_path: Path,
    campus_id: int,
    week_start_date: str,
    unique_students_count: int,
    source_status: str,
) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO weekly_campus_attendance (
            campus_id,
            week_start_date,
            unique_students_count,
            collected_at,
            source_status
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(campus_id, week_start_date) DO UPDATE SET
            unique_students_count = excluded.unique_students_count,
            collected_at = excluded.collected_at,
            source_status = excluded.source_status
        """,
        (campus_id, week_start_date, unique_students_count, iso_now(), source_status),
    )
    conn.commit()
    conn.close()


def insert_cursus_active_counts(
    db_path: Path,
    campus_id: int,
    rows: list[dict[str, Any]],
    source_status: str,
) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)
    for row in rows:
        conn.execute(
            """
            INSERT INTO cursus_active_counts (
                campus_id,
                cursus_id,
                cursus_name,
                active_users_count,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                campus_id,
                row["cursus_id"],
                row["cursus_name"],
                row["active_users_count"],
                collected_at,
                source_status,
            ),
        )
    conn.commit()
    conn.close()


def upsert_weekly_project_activity_count(
    db_path: Path,
    campus_id: int,
    week_start_date: str,
    active_or_started_projects_count: int,
    created_events_count: int,
    updated_events_count: int,
    source_status: str,
) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO weekly_project_activity_counts (
            campus_id,
            week_start_date,
            active_or_started_projects_count,
            created_events_count,
            updated_events_count,
            collected_at,
            source_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(campus_id, week_start_date) DO UPDATE SET
            active_or_started_projects_count = excluded.active_or_started_projects_count,
            created_events_count = excluded.created_events_count,
            updated_events_count = excluded.updated_events_count,
            collected_at = excluded.collected_at,
            source_status = excluded.source_status
        """,
        (
            campus_id,
            week_start_date,
            active_or_started_projects_count,
            created_events_count,
            updated_events_count,
            iso_now(),
            source_status,
        ),
    )
    conn.commit()
    conn.close()


def prune_old_short_term_data(db_path: Path, retention_days: int = 84) -> None:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat()
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM project_pass_event WHERE marked_at < ?", (cutoff,))
    conn.execute("DELETE FROM project_activity_event WHERE activity_at < ?", (cutoff,))
    conn.execute("DELETE FROM location_event WHERE begin_at < ?", (cutoff,))
    conn.execute("DELETE FROM cursus_user_snapshot WHERE collected_at < ?", (cutoff,))
    conn.execute("DELETE FROM cursus_active_counts WHERE collected_at < ?", (cutoff,))
    conn.commit()
    conn.close()


def compute_weekly_location_aggregates(
    rows: list[dict[str, Any]],
    week_start: datetime,
    week_end: datetime,
) -> tuple[list[dict[str, Any]], int]:
    per_user: dict[int, dict[str, int]] = {}
    unique_students: set[int] = set()

    for row in rows:
        begin_dt = parse_api_datetime(row.get("begin_at"))
        end_dt = parse_api_datetime(row.get("end_at")) if row.get("end_at") else week_end
        if begin_dt is None or end_dt is None:
            continue

        overlap_start = max(begin_dt, week_start)
        overlap_end = min(end_dt, week_end)
        seconds = int((overlap_end - overlap_start).total_seconds())
        if seconds <= 0:
            continue

        user_id = int(row["user_id"])
        current = per_user.setdefault(user_id, {"seconds_logged": 0, "sessions_count": 0})
        current["seconds_logged"] += seconds
        current["sessions_count"] += 1
        unique_students.add(user_id)

    user_rows = [
        {
            "user_id": user_id,
            "seconds_logged": values["seconds_logged"],
            "sessions_count": values["sessions_count"],
        }
        for user_id, values in per_user.items()
    ]
    return user_rows, len(unique_students)


def compute_cursus_active_counts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[int, dict[str, Any]] = {}
    seen_pairs: set[tuple[int, int]] = set()

    for row in rows:
        cursus_id = int(row["cursus_id"])
        user_id = int(row["user_id"])
        pair = (cursus_id, user_id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)

        current = grouped.setdefault(
            cursus_id,
            {
                "cursus_id": cursus_id,
                "cursus_name": row.get("cursus_name", ""),
                "active_users_count": 0,
            },
        )
        current["active_users_count"] += 1

    return list(grouped.values())


def compute_weekly_project_activity_counts(rows: list[dict[str, Any]]) -> tuple[int, int, int]:
    created_count = 0
    updated_count = 0
    project_keys: set[str] = set()

    for row in rows:
        if row["activity_type"] == "created":
            created_count += 1
        elif row["activity_type"] == "updated":
            updated_count += 1

        projects_user_id = row.get("projects_user_id")
        if projects_user_id is not None:
            project_keys.add(f"pu:{projects_user_id}")
        else:
            project_keys.add(f"p:{row['project_id']}:u:{row['user_id']}")

    return len(project_keys), created_count, updated_count


def should_run_weekly(db_path: Path, force: bool = False) -> bool:
    if force:
        return True
    last_run_raw = get_sync_cursor(db_path, WEEKLY_SYNC_JOB, "last_completed_at")
    last_run = parse_iso_datetime(last_run_raw)
    if last_run is None:
        return True
    return datetime.now(timezone.utc) - last_run >= timedelta(days=7)


def build_sync_windows(now: datetime) -> dict[str, str]:
    today = now.date()
    week_start_dt = now - timedelta(days=7)
    return {
        "week_start_date": week_start_dt.date().isoformat(),
        "week_range": f"{week_start_dt.date().isoformat()},{today.isoformat()}",
        "day_range": f"{(now - timedelta(days=1)).date().isoformat()},{today.isoformat()}",
        "window_end_date": today.isoformat(),
    }


def run_weekly_sync(
    db_path: Path,
    config_path: Path,
    campus_id: int,
    limiter: ApiRateLimiter,
    client: Any,
    now: datetime,
    sync_windows: dict[str, str],
) -> dict[str, Any]:
    blocs_payload = fetch_paginated_records(
        config_path,
        "/blocs",
        params={"filter[campus_id]": campus_id},
        limiter=limiter,
        client=client,
    )
    coalition_scores = normalize_coalition_scores(blocs_payload, campus_id=campus_id)

    coalition_user_scores: list[dict[str, Any]] = []
    coalition_ids = {
        int(coalition.get("id"))
        for bloc in blocs_payload
        for coalition in bloc.get("coalitions", [])
        if coalition.get("id") is not None
    }
    for coalition_id in coalition_ids:
        coalitions_users_payload = fetch_paginated_records(
            config_path,
            f"/coalitions/{coalition_id}/coalitions_users",
            limiter=limiter,
            client=client,
        )
        coalition_user_scores.extend(normalize_coalition_user_scores(coalitions_users_payload, campus_id=campus_id))

    projects_created_payload = fetch_paginated_records(
        config_path,
        "/projects_users",
        params={
            "filter[campus]": campus_id,
            "range[created_at]": sync_windows["week_range"],
        },
        limiter=limiter,
        client=client,
    )
    projects_updated_payload = fetch_paginated_records(
        config_path,
        "/projects_users",
        params={
            "filter[campus]": campus_id,
            "range[updated_at]": sync_windows["week_range"],
        },
        limiter=limiter,
        client=client,
    )
    project_activity_rows = normalize_project_activity(projects_created_payload, campus_id, "created")
    project_activity_rows.extend(normalize_project_activity(projects_updated_payload, campus_id, "updated"))

    cursus_payload = fetch_paginated_records(
        config_path,
        "/cursus_users",
        params={
            "filter[campus_id]": campus_id,
            "filter[active]": "true",
        },
        limiter=limiter,
        client=client,
    )
    cursus_rows = normalize_cursus_users(cursus_payload, campus_id=campus_id)

    locations_payload = fetch_paginated_records(
        config_path,
        f"/campus/{campus_id}/locations",
        params={"range[begin_at]": sync_windows["week_range"]},
        limiter=limiter,
        client=client,
    )
    location_rows = normalize_locations(locations_payload, campus_id=campus_id)

    upsert_coalition_score_snapshot(db_path, coalition_scores, source_status="live_api")
    insert_coalition_user_scores(db_path, coalition_user_scores, source_status="live_api")
    insert_project_activity_events(db_path, project_activity_rows, source_status="live_api")
    insert_cursus_user_snapshot(db_path, cursus_rows, source_status="live_api")
    insert_location_events(db_path, location_rows, source_status="live_api")

    week_start_dt = now - timedelta(days=7)
    weekly_user_logtime_rows, weekly_attendance_count = compute_weekly_location_aggregates(
        location_rows,
        week_start=week_start_dt,
        week_end=now,
    )
    upsert_weekly_user_logtime(
        db_path,
        campus_id=campus_id,
        week_start_date=sync_windows["week_start_date"],
        rows=weekly_user_logtime_rows,
        source_status="live_api",
    )
    upsert_weekly_campus_attendance(
        db_path,
        campus_id=campus_id,
        week_start_date=sync_windows["week_start_date"],
        unique_students_count=weekly_attendance_count,
        source_status="live_api",
    )

    cursus_active_rows = compute_cursus_active_counts(cursus_rows)
    insert_cursus_active_counts(
        db_path,
        campus_id=campus_id,
        rows=cursus_active_rows,
        source_status="live_api",
    )

    active_or_started_projects_count, created_events_count, updated_events_count = compute_weekly_project_activity_counts(
        project_activity_rows
    )
    upsert_weekly_project_activity_count(
        db_path,
        campus_id=campus_id,
        week_start_date=sync_windows["week_start_date"],
        active_or_started_projects_count=active_or_started_projects_count,
        created_events_count=created_events_count,
        updated_events_count=updated_events_count,
        source_status="live_api",
    )

    first_user_id, last_user_id, campus_user_ids = get_campus_user_id_bounds(db_path, campus_id)
    achievements_earned_count = 0
    if first_user_id is not None and last_user_id is not None and campus_user_ids:
        achievements_rewarded_payload = fetch_paginated_records(
            config_path,
            "/achievements_users",
            params={
                "range[user_id]": f"{first_user_id},{last_user_id}",
                "range[created_at]": sync_windows["week_range"],
            },
            limiter=limiter,
            client=client,
        )
        achievements_earned_count = count_weekly_achievements_earned(
            achievements_rewarded_payload,
            campus_user_ids=campus_user_ids,
        )

    insert_short_term_metric_snapshot(
        db_path,
        campus_id=campus_id,
        metric_name="weekly_achievements_earned",
        metric_value=achievements_earned_count,
        payload={
            "week_start_date": sync_windows["week_start_date"],
            "window_end_date": sync_windows["window_end_date"],
        },
        source_status="live_api",
    )
    set_sync_cursor(db_path, WEEKLY_SYNC_JOB, "last_completed_at", iso_now())

    return {
        "coalition_scores_count": len(coalition_scores),
        "coalition_user_scores_count": len(coalition_user_scores),
        "project_activity_events_count": len(project_activity_rows),
        "locations_count": len(location_rows),
        "cursus_rows_count": len(cursus_rows),
        "weekly_achievements_earned": achievements_earned_count,
    }


def run_daily_project_pass_sync(
    db_path: Path,
    config_path: Path,
    campus_id: int,
    limiter: ApiRateLimiter,
    client: Any,
    sync_windows: dict[str, str],
) -> list[dict[str, Any]]:
    projects_passed_payload = fetch_paginated_records(
        config_path,
        "/projects_users",
        params={
            "filter[campus]": campus_id,
            "range[marked_at]": sync_windows["day_range"],
        },
        limiter=limiter,
        client=client,
    )
    project_pass_rows = normalize_project_passes(projects_passed_payload, campus_id=campus_id)
    insert_project_pass_events(db_path, project_pass_rows, source_status="live_api")
    set_sync_cursor(db_path, DAILY_SYNC_JOB, "last_completed_at", iso_now())
    return project_pass_rows


def sync_short_term_data(db_path: Path, config_path: Path, campus_id: int, force: bool = False) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    sync_windows = build_sync_windows(now)

    limiter = ApiRateLimiter(max_per_second=2, max_per_hour=900)
    client = get_client(config_path)

    weekly_result = {
        "coalition_scores_count": 0,
        "coalition_user_scores_count": 0,
        "project_activity_events_count": 0,
        "locations_count": 0,
        "cursus_rows_count": 0,
        "weekly_achievements_earned": 0,
    }
    project_pass_rows: list[dict[str, Any]] = []
    budget_exhausted = False
    budget_error: str | None = None

    weekly_ran = should_run_weekly(db_path, force=force)

    if weekly_ran:
        try:
            weekly_result = run_weekly_sync(
                db_path=db_path,
                config_path=config_path,
                campus_id=campus_id,
                limiter=limiter,
                client=client,
                now=now,
                sync_windows=sync_windows,
            )
        except ApiBudgetExceeded as exc:
            budget_exhausted = True
            budget_error = str(exc)

    try:
        project_pass_rows = run_daily_project_pass_sync(
            db_path=db_path,
            config_path=config_path,
            campus_id=campus_id,
            limiter=limiter,
            client=client,
            sync_windows=sync_windows,
        )
    except ApiBudgetExceeded as exc:
        budget_exhausted = True
        budget_error = str(exc)

    prune_old_short_term_data(db_path)

    return {
        "campus_id": campus_id,
        "source_mode": "budget_limited" if budget_exhausted else "refreshed",
        "budget_exhausted": budget_exhausted,
        "budget_error": budget_error,
        "weekly_ran": weekly_ran,
        "coalition_scores_count": weekly_result["coalition_scores_count"],
        "coalition_user_scores_count": weekly_result["coalition_user_scores_count"],
        "project_activity_events_count": weekly_result["project_activity_events_count"],
        "project_pass_events_count": len(project_pass_rows),
        "locations_count": weekly_result["locations_count"],
        "cursus_rows_count": weekly_result["cursus_rows_count"],
        "weekly_achievements_earned": weekly_result["weekly_achievements_earned"],
    }