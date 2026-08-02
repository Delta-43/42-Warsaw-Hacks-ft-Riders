from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from short_term_sync import (
    compute_cursus_active_counts,
    compute_weekly_location_aggregates,
    compute_weekly_project_activity_counts,
)


def test_compute_weekly_location_aggregates_counts_overlap_seconds() -> None:
    week_end = datetime(2026, 8, 2, 12, 0, 0, tzinfo=timezone.utc)
    week_start = week_end - timedelta(days=7)

    rows = [
        {
            "user_id": 1,
            "begin_at": "2026-08-01T10:00:00.000Z",
            "end_at": "2026-08-01T11:30:00.000Z",
        },
        {
            "user_id": 1,
            "begin_at": "2026-08-01T12:00:00.000Z",
            "end_at": None,
        },
        {
            "user_id": 2,
            "begin_at": "2026-07-20T10:00:00.000Z",
            "end_at": "2026-07-20T11:00:00.000Z",
        },
    ]

    user_rows, attendance_count = compute_weekly_location_aggregates(rows, week_start, week_end)

    assert attendance_count == 1
    by_user = {row["user_id"]: row for row in user_rows}
    assert 1 in by_user
    assert by_user[1]["sessions_count"] == 2
    assert by_user[1]["seconds_logged"] == 5400 + 86400


def test_compute_cursus_active_counts_dedupes_per_user_and_cursus() -> None:
    rows = [
        {"cursus_id": 21, "cursus_name": "42cursus", "user_id": 1},
        {"cursus_id": 21, "cursus_name": "42cursus", "user_id": 1},
        {"cursus_id": 21, "cursus_name": "42cursus", "user_id": 2},
        {"cursus_id": 9, "cursus_name": "Piscine", "user_id": 3},
    ]

    result = compute_cursus_active_counts(rows)
    by_cursus = {row["cursus_id"]: row for row in result}

    assert by_cursus[21]["active_users_count"] == 2
    assert by_cursus[9]["active_users_count"] == 1


def test_compute_weekly_project_activity_counts_dedupes_using_projects_user_id() -> None:
    rows = [
        {
            "project_id": 100,
            "user_id": 1,
            "projects_user_id": 5001,
            "activity_type": "created",
        },
        {
            "project_id": 100,
            "user_id": 1,
            "projects_user_id": 5001,
            "activity_type": "updated",
        },
        {
            "project_id": 101,
            "user_id": 1,
            "projects_user_id": None,
            "activity_type": "updated",
        },
    ]

    unique_projects, created_count, updated_count = compute_weekly_project_activity_counts(rows)

    assert unique_projects == 2
    assert created_count == 1
    assert updated_count == 2