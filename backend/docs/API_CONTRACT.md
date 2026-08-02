# Backend API Contract

This file documents the backend endpoints the frontend can safely rely on.

## Conventions

- All responses are JSON objects.
- Cached metric endpoints usually include:
  - `source_mode`: `fresh_cache`, `refreshed`, `budget_limited`, or `stale_fallback`
  - `data_timestamp`: ISO timestamp for the relevant cache refresh
- `campus_id` is `67` for Warsaw by default unless configured otherwise.

## Health

### `GET /health`

Use this to verify that the backend process is running.

Response shape:

```json
{
  "status": "ok",
  "service": "42 Warsaw Campus Dashboard API",
  "time": "2026-08-02T01:16:17.332922+00:00"
}
```

## Config

### `GET /api/v1/config`

Lets the frontend discover the primary campus id at runtime instead of baking it
into the static build. Call this once on load and use the returned id for the
`{campus_id}` path segments below.

Response shape:

```json
{
  "primary_campus_id": 67
}
```

## Refresh Status

### `GET /api/v1/refresh/status`

Use this for admin/debug state, not for primary dashboard cards.

Response shape:

```json
{
  "checked_at": "2026-08-02T01:16:17.332922+00:00",
  "jobs": {
    "long_term": {
      "in_progress": false,
      "last_successful_refresh": "2026-08-02T01:10:00+00:00",
      "state": "idle",
      "stage": "completed",
      "started_at": null,
      "finished_at": null,
      "processed": 0,
      "total": 0,
      "failures": 0,
      "last_error": null
    },
    "short_term": {
      "in_progress": false,
      "last_successful_refresh": "2026-08-02T01:16:17+00:00",
      "state": "idle",
      "stage": "completed",
      "started_at": null,
      "finished_at": null,
      "last_error": null
    }
  }
}
```

## Coalition Standings

### `GET /api/v1/campus/{campus_id}/coalitions/standings`

Frontend use:
- standings card or table
- coalition name, score, and theme color

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "standings": {
    "campus_id": 67,
    "total": 3,
    "items": [
      {
        "coalition_id": 459,
        "campus_id": 67,
        "cursus_id": 21,
        "coalition_name": "Lunaria",
        "slug": "lunaria",
        "image_url": "https://...",
        "cover_url": "https://...",
        "color": "#52BDFF",
        "score": 43216,
        "score_collected_at": "2026-08-02T01:16:16.803410+00:00",
        "last_seen_at": "2026-08-02T01:10:00+00:00"
      }
    ]
  }
}
```

## Coalition Top Scorers

### `GET /api/v1/campus/{campus_id}/coalitions/top-scorers`

Optional query:
- `limit_per_coalition` default `10`

Frontend use:
- top 10 students for each coalition

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "top_scorers": {
    "campus_id": 67,
    "total": 30,
    "items": [
      {
        "coalition_id": 458,
        "user_id": 1001,
        "score": 4200,
        "rank": 1,
        "collected_at": "2026-08-02T01:16:16.803410+00:00",
        "coalition_name": "Orionis",
        "slug": "orionis",
        "color": "#BE2AD1",
        "login": "tester",
        "first_name": "Test",
        "last_name": "User"
      }
    ]
  }
}
```

## Weekly Logtime Leaders

### `GET /api/v1/campus/{campus_id}/users/logtime-top`

Optional query:
- `limit` default `10`

Frontend use:
- top logged-on students over the last computed weekly window

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "logtime_rankings": {
    "campus_id": 67,
    "week_start_date": "2026-07-26",
    "total": 10,
    "items": [
      {
        "user_id": 1001,
        "seconds_logged": 10800,
        "sessions_count": 4,
        "week_start_date": "2026-07-26",
        "collected_at": "2026-08-02T01:16:16.803410+00:00",
        "login": "tester",
        "first_name": "Test",
        "last_name": "User",
        "image": {"link": "https://..."},
        "image_url": "https://...",
        "hours_logged": 3.0
      }
    ]
  }
}
```

## Recent Project Passes

### `GET /api/v1/campus/{campus_id}/projects/passed-recent`

Optional query:
- `hours` default `24`
- `limit` default `200`
- `include_started_after_pass` reserved for future use

Frontend use:
- recent project passes card/list

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "future_capability": {
    "include_started_after_pass": false,
    "implemented": false,
    "note": "Planned: correlate pass events with project_activity_event by user_id and activity_at > marked_at."
  },
  "projects_passed_recent": {
    "campus_id": 67,
    "window_hours": 24,
    "total": 10,
    "items": [
      {
        "user_id": 1001,
        "project_id": 1314,
        "project_name": "Libft",
        "projects_user_id": 555001,
        "marked_at": "2026-08-02T00:30:00+00:00",
        "user_login": "tester",
        "user_image_url": "https://...",
        "user_profile_url": "https://api.intra.42.fr/v2/users/tester",
        "collected_at": "2026-08-02T01:16:16.803410+00:00"
      }
    ]
  }
}
```

## Active Users Per Cursus

### `GET /api/v1/campus/{campus_id}/cursus/active-counts`

Frontend use:
- static counts by cursus

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "active_cursus_counts": {
    "campus_id": 67,
    "total": 11,
    "collected_at": "2026-08-02T01:16:16.803410+00:00",
    "items": [
      {
        "cursus_id": 21,
        "cursus_name": "42cursus",
        "active_users_count": 456,
        "collected_at": "2026-08-02T01:16:16.803410+00:00"
      }
    ]
  }
}
```

## Weekly Campus Attendance

### `GET /api/v1/campus/{campus_id}/attendance/weekly`

Frontend use:
- total students who came to campus last week

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "attendance": {
    "campus_id": 67,
    "week_start_date": "2026-07-26",
    "unique_students_count": 116,
    "collected_at": "2026-08-02T01:16:16.803410+00:00"
  }
}
```

## Weekly Project Activity

### `GET /api/v1/campus/{campus_id}/projects/activity-weekly`

Frontend use:
- count of active or started projects over the weekly window

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "project_activity": {
    "campus_id": 67,
    "week_start_date": "2026-07-26",
    "active_or_started_projects_count": 182,
    "created_events_count": 31,
    "updated_events_count": 46,
    "collected_at": "2026-08-02T01:16:16.803410+00:00"
  }
}
```

## Weekly Achievements Earned

### `GET /api/v1/campus/{campus_id}/achievements/earned-weekly`

Frontend use:
- simple weekly achievements card

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "weekly_achievements_earned": {
    "metric_name": "weekly_achievements_earned",
    "metric_value": 83.0,
    "collected_at": "2026-08-02T01:16:16.803410+00:00",
    "source_status": "live_api",
    "payload": {
      "week_start_date": "2026-07-26",
      "window_end_date": "2026-08-02"
    }
  }
}
```

## Analytics Pills

### `GET /api/v1/campus/{campus_id}/analytics/pills`

Frontend use:
- compact summary cards and grouped overview panels

Response shape:

```json
{
  "source_mode": "fresh_cache",
  "data_timestamp": "2026-08-02T01:16:17.332922+00:00",
  "analytics": {
    "campus_id": 67,
    "users": {
      "total": 1550,
      "active": 353,
      "active_ratio": 0.2277
    },
    "achievements": {
      "earned_this_week": 83
    },
    "coalition_scores": {
      "avg_user_score": 1200.5,
      "top_user_score": 4200,
      "ranked_users": 515
    }
  }
}
```

Notes:
- `earned_this_week` is the new low-bandwidth achievements metric.
- The older achievement coverage model has been removed from the active frontend contract.
