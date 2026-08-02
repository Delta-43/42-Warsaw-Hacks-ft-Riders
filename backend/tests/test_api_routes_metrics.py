from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


def _seed_cache(db_path: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    recent_marked_at = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()

    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO campus_user (
            user_id, campus_id, login, first_name, last_name, url, kind, image,
            pool_month, pool_year, active, alumni, is_staff, is_alumni, is_active,
            achievements_count, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            1001,
            67,
            "tester",
            "Test",
            "User",
            "https://api.intra.42.fr/v2/users/tester",
            "student",
            '{"link": "https://cdn.intra.42.fr/users/tester.jpg"}',
            "july",
            "2026",
            1,
            0,
            0,
            0,
            1,
            0,
            now,
        ),
    )
    conn.execute(
        """
        INSERT INTO weekly_user_logtime (
            campus_id, user_id, week_start_date, seconds_logged, sessions_count, collected_at, source_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (67, 1001, "2026-07-26", 10800, 4, now, "seed"),
    )
    conn.execute(
        """
        INSERT INTO project_pass_event (
            campus_id, user_id, project_id, project_name, projects_user_id, marked_at,
            user_login, user_image_url, user_profile_url, collected_at, source_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            67,
            1001,
            1314,
            "Libft",
            555001,
            recent_marked_at,
            "tester",
            "https://cdn.intra.42.fr/users/tester.jpg",
            "https://api.intra.42.fr/v2/users/tester",
            now,
            "seed",
        ),
    )
    conn.execute(
        """
        INSERT INTO weekly_campus_attendance (
            campus_id, week_start_date, unique_students_count, collected_at, source_status
        ) VALUES (?, ?, ?, ?, ?)
        """,
        (67, "2026-07-26", 123, now, "seed"),
    )
    conn.execute(
        """
        INSERT INTO weekly_project_activity_counts (
            campus_id, week_start_date, active_or_started_projects_count,
            created_events_count, updated_events_count, collected_at, source_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (67, "2026-07-26", 77, 31, 46, now, "seed"),
    )
    conn.execute(
        """
        INSERT INTO cursus_active_counts (
            campus_id, cursus_id, cursus_name, active_users_count, collected_at, source_status
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (67, 21, "42cursus", 456, now, "seed"),
    )
    conn.execute(
        """
        INSERT INTO short_term_metric_snapshot (
            campus_id, metric_name, metric_value, payload_json, collected_at, source_status
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            67,
            "weekly_achievements_earned",
            83,
            '{"week_start_date": "2026-07-26", "window_end_date": "2026-08-02"}',
            now,
            "seed",
        ),
    )
    conn.execute(
        """
        INSERT INTO coalition_reference (
            coalition_id, campus_id, cursus_id, coalition_name, slug, image_url, cover_url, color, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (458, 67, 21, "Orionis", "orionis", "", "", "#BE2AD1", now),
    )
    conn.execute(
        """
        INSERT INTO coalition_score_snapshot (
            coalition_id, campus_id, score, collected_at, source_status
        ) VALUES (?, ?, ?, ?, ?)
        """,
        (458, 67, 35818, now, "seed"),
    )
    conn.execute(
        """
        INSERT INTO coalition_user_score_snapshot (
            campus_id, coalition_id, user_id, score, rank, collected_at, source_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (67, 458, 1001, 4200, 1, now, "seed"),
    )
    conn.commit()
    conn.close()


def _build_app_with_temp_db(tmp_path):
    db_path = tmp_path / "test_dashboard_cache.db"
    main.DB_PATH = db_path
    main.init_db()
    _seed_cache(str(db_path))
    return main.create_app(enable_background_sync=False)


def test_config_endpoint_returns_primary_campus_id(tmp_path) -> None:
    app = _build_app_with_temp_db(tmp_path)
    with TestClient(app) as client:
        response = client.get("/api/v1/config")

    assert response.status_code == 200
    assert response.json() == {"primary_campus_id": main.PRIMARY_CAMPUS_ID}


def test_logtime_top_endpoint_returns_ranked_rows(tmp_path) -> None:
    app = _build_app_with_temp_db(tmp_path)
    with TestClient(app) as client:
        response = client.get("/api/v1/campus/67/users/logtime-top")

    assert response.status_code == 200
    payload = response.json()
    assert "logtime_rankings" in payload
    assert payload["logtime_rankings"]["total"] == 1
    assert payload["logtime_rankings"]["items"][0]["login"] == "tester"


def test_recent_passes_endpoint_returns_data_and_future_toggle(tmp_path) -> None:
    app = _build_app_with_temp_db(tmp_path)
    with TestClient(app) as client:
        response = client.get("/api/v1/campus/67/projects/passed-recent")

    assert response.status_code == 200
    payload = response.json()
    assert "projects_passed_recent" in payload
    assert payload["projects_passed_recent"]["total"] == 1
    assert payload["projects_passed_recent"]["items"][0]["project_name"] == "Libft"
    assert payload["future_capability"]["implemented"] is False


def test_weekly_attendance_and_project_activity_endpoints(tmp_path) -> None:
    app = _build_app_with_temp_db(tmp_path)
    with TestClient(app) as client:
        attendance = client.get("/api/v1/campus/67/attendance/weekly")
        activity = client.get("/api/v1/campus/67/projects/activity-weekly")

    assert attendance.status_code == 200
    assert attendance.json()["attendance"]["unique_students_count"] == 123
    assert activity.status_code == 200
    assert activity.json()["project_activity"]["active_or_started_projects_count"] == 77


def test_cursus_active_counts_endpoint(tmp_path) -> None:
    app = _build_app_with_temp_db(tmp_path)
    with TestClient(app) as client:
        response = client.get("/api/v1/campus/67/cursus/active-counts")

    assert response.status_code == 200
    payload = response.json()["active_cursus_counts"]
    assert payload["total"] == 1
    assert payload["items"][0]["active_users_count"] == 456


def test_weekly_achievements_endpoint_and_analytics_pills(tmp_path) -> None:
    app = _build_app_with_temp_db(tmp_path)
    with TestClient(app) as client:
        metric_response = client.get("/api/v1/campus/67/achievements/earned-weekly")
        analytics_response = client.get("/api/v1/campus/67/analytics/pills")

    assert metric_response.status_code == 200
    assert metric_response.json()["weekly_achievements_earned"]["metric_value"] == 83
    assert analytics_response.status_code == 200
    assert analytics_response.json()["analytics"]["achievements"]["earned_this_week"] == 83


def test_coalition_alias_endpoints(tmp_path) -> None:
    app = _build_app_with_temp_db(tmp_path)
    with TestClient(app) as client:
        top_scorers = client.get("/api/v1/campus/67/coalitions/top-scorers")
        standings = client.get("/api/v1/campus/67/coalitions/standings")

    assert top_scorers.status_code == 200
    assert top_scorers.json()["top_scorers"]["total"] == 1
    assert standings.status_code == 200
    assert standings.json()["standings"]["total"] == 1