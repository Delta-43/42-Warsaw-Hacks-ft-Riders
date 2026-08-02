# Backend Execution Plan

This plan is based on the current backend structure (FastAPI + SQLite cache + sync jobs) and extends it to serve the first analytics endpoints cleanly while staying inside the 42 API request budget.

## Goals For This Iteration

Serve these frontend datasets from database cache (not direct API calls):

1. Top 10 highest scorers from each coalition.
2. Coalition standings.
3. Top 10 users by total logged time in the last 7 days.
4. Users who passed a project in the last 24 hours (with project name and profile image).
5. Static counts of active users per cursus.
6. Static count of students who came to campus in the last week.
7. Total number of projects actively worked on or started in the last week.

## Guiding Principles

- Keep the existing modular split: scheduler/coordinator, sync modules, and route handlers.
- Prefer normalized source tables + small aggregate tables for fast endpoints.
- Make every endpoint read from DB only.
- API calls happen only in scheduled sync jobs.
- Use explicit checkpoints after each critical phase.

## Proposed Database Structure

The current DB already has good foundations. We add a few focused tables so each frontend card can be served in O(1) to O(log n) query cost.

### Core Reference Tables

- campus_reference
  - campus_id PK, campus_name, city, country, last_seen_at
- campus_user
  - user_id PK, campus_id, login, name fields, image, active flags, last_seen_at
- coalition_reference
  - coalition_id PK, campus_id, cursus_id, coalition_name, branding fields, last_seen_at

### Snapshot / Event Tables

- coalition_score_snapshot
  - coalition_id, campus_id, score, collected_at
  - used for coalition standings timeline
- coalition_user_score_snapshot
  - campus_id, coalition_id, user_id, score, rank, collected_at
  - used for top 10 in each coalition
- project_pass_event
  - id PK, campus_id, user_id, project_id, project_name, projects_user_id, marked_at, user_login, user_image_url, user_profile_url, collected_at
  - dedupe key: unique(campus_id, user_id, project_id, marked_at)
  - used for last 24h project passes
- project_activity_event
  - id PK, campus_id, user_id, project_id, project_name, projects_user_id, activity_type, activity_at, collected_at
  - activity_type in {created, updated}
  - used for weekly active or started project counting and future user-level correlations
- location_event
  - id PK, campus_id, user_id, begin_at, end_at, host, collected_at
  - used to compute weekly logtime and campus attendance
- cursus_user_snapshot
  - id PK, campus_id, user_id, cursus_id, cursus_name, is_active, collected_at
  - used for active users per cursus

### Aggregate Tables (Materialized Metrics)

- weekly_user_logtime
  - campus_id, user_id, week_start_date, seconds_logged, sessions_count, collected_at
  - PK: (campus_id, user_id, week_start_date)
- weekly_campus_attendance
  - campus_id, week_start_date, unique_students_count, collected_at
  - PK: (campus_id, week_start_date)
- cursus_active_counts
  - campus_id, cursus_id, cursus_name, active_users_count, collected_at
  - PK: (campus_id, cursus_id, collected_at)
- weekly_project_activity_counts
  - campus_id, week_start_date, active_or_started_projects_count, created_events_count, updated_events_count, collected_at
  - PK: (campus_id, week_start_date)

### Recommended Indexes

- project_pass_event(campus_id, marked_at desc)
- project_activity_event(campus_id, activity_at)
- project_activity_event(campus_id, user_id, activity_at)
- location_event(campus_id, begin_at)
- location_event(campus_id, user_id, begin_at)
- cursus_user_snapshot(campus_id, is_active, collected_at)
- weekly_user_logtime(campus_id, week_start_date, seconds_logged desc)
- coalition_user_score_snapshot(campus_id, collected_at, coalition_id, rank)

## Sync Cadence And Responsibilities

### Monthly Sync Job

Sources:
- /campus/{campus_id}
- /campus/{campus_id}/users
- /blocs?filter[campus_id]=...

Writes:
- campus_reference, campus_metrics_snapshot
- campus_user
- coalition_reference

Reason:
- Low volatility foundational data.

### Weekly Sync Job

Sources:
- /coalitions/{coalition_id}/coalitions_users
- /projects_users with range[created_at] last 7d
- /projects_users with range[updated_at] last 7d
- /cursus_users?filter[campus_id]=...&filter[active]=true
- /campus/{campus_id}/locations with range[begin_at] last 7d

Writes:
- coalition_user_score_snapshot, coalition_score_snapshot
- project_activity_event
- cursus_user_snapshot
- location_event
- weekly_user_logtime (recomputed)
- weekly_campus_attendance (recomputed)
- cursus_active_counts (recomputed)
- weekly_project_activity_counts (recomputed)

Reason:
- Weekly behavioral metrics for rankings and attendance.

### Daily Sync Job

Sources:
- /projects_users with range[marked_at] last 24h

Writes:
- project_pass_event

Reason:
- Feed the recent passes card without waiting a week.

## Endpoint-To-Table Mapping

1) Top 10 highest scorers from each coalition
- Source: coalition_user_score_snapshot (latest collected_at)
- Join: coalition_reference + campus_user
- Output: coalition, rank, score, user name/login, profile image

2) Coalition standings
- Source: coalition_score_snapshot (latest collected_at)
- Join: coalition_reference
- Output: coalition name, color, score, rank order

3) Top 10 users by log time last week
- Source: weekly_user_logtime for latest week_start_date
- Join: campus_user
- Output: user + seconds_logged + formatted hours

4) Project passes in last 24h
- Source: project_pass_event where marked_at >= now-24h
- Output: user login/name, project_name, profile image URL

5) Active users per cursus (static)
- Source: latest cursus_active_counts snapshot
- Output: cursus name + active_users_count

6) Students who came to campus last week (static)
- Source: latest weekly_campus_attendance snapshot
- Output: unique_students_count

7) Total number of projects actively worked on or started in the last week
- Source: latest weekly_project_activity_counts snapshot
- Output: active_or_started_projects_count

Future flexibility for endpoint 4
- Project pass events keep projects_user_id and user_id so we can later add an optional flag like include_started_after_pass=true.
- That future behavior can join project_pass_event with project_activity_event on user_id and filter activity_at > marked_at.

## API Rate-Limit Strategy

Hard limits:
- <= 1000 requests per hour
- <= 2 requests per second

Implementation:

- Use a shared request limiter wrapper around all API calls.
  - Token bucket for 2 req/s (capacity 2).
  - Rolling counter for hourly budget (stop sync early at 900 to keep safety margin).
- Keep page size at 100 and use pagination helpers already present.
- Prefer incremental windows for events:
  - daily marked_at window for project passes
  - weekly begin_at window for locations
- Persist sync cursors in DB for resumable sync:
  - sync_cursor(job_name, cursor_key, cursor_value, updated_at)
- If budget is near exhaustion:
  - Finish current page.
  - Save checkpoint cursor.
  - Continue on next run.

## Checkpoints (Approval Gates)

### Checkpoint 1: Schema Ready

Deliverables:
- Migration adding new event and aggregate tables + indexes.
- Minimal ERD in docs.

Validation:
- DB boots cleanly from empty.
- Existing endpoints still run.

### Checkpoint 2: Sync Layer Updated

Deliverables:
- Weekly sync writes locations, cursus snapshots, coalition users.
- Daily sync writes project pass events.
- Weekly sync writes project activity events and weekly project activity aggregate.
- Shared API limiter + cursor state.

Validation:
- Dry-run mode prints expected insert counts.
- One real sync succeeds inside rate limits.

### Checkpoint 3: Aggregations Correct

Deliverables:
- weekly_user_logtime calculation.
- weekly_campus_attendance calculation.
- cursus_active_counts calculation.
- weekly_project_activity_counts calculation.

Validation:
- Spot-check 10 random users against raw location events.
- Verify unique attendance count logic.

### Checkpoint 4: Read Endpoints Complete

Deliverables:
- 6 frontend-facing endpoints implemented in api_routes.
- 7 frontend-facing endpoints implemented in api_routes.
- Response payloads stable and documented.

Validation:
- Endpoint tests pass against seeded DB.
- No endpoint performs upstream API call.

### Checkpoint 5: Stability And Cleanup

Deliverables:
- Retention policy for high-volume tables (for example 8-12 weeks for raw location_event, longer for aggregates).
- Error handling and refresh status visibility.

Validation:
- Forced refresh and fallback behavior verified.
- Docs updated for maintainers.

## Simple Module Layout (Keep It Maintainable)

- main.py
  - app bootstrap, scheduler, job coordination
- long_term_sync.py
  - monthly sync
- short_term_sync.py
  - split into weekly_sync and daily_sync functions
- sync_rate_limit.py (new)
  - throttling and hourly budget guard
- db_schema.py (new)
  - schema init + migrations helpers
- aggregates.py (new)
  - weekly rollups and static counters
- api_routes.py
  - read-only HTTP handlers

## Implementation Order

1. Add schema migrations and indexes.
2. Add shared API limiter + cursor table.
3. Extend sync jobs (weekly and daily).
4. Add aggregate calculators.
5. Add/adjust the 6 frontend endpoints.
6. Add tests and seed fixtures.
7. Run one full refresh and verify payloads.

## Out Of Scope For This Pass

- Advanced predictive analytics.
- Real-time websocket updates.
- Multi-campus federation in a single response.

Those can be layered after this baseline is stable.