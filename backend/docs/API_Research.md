# 42 Intra API Research

How we scoped the 42 Intra API before writing any sync code. The raw
artifacts are still here if you want the unfiltered version:

- [`../.test_cases/apis to work with.txt`](../.test_cases/apis%20to%20work%20with.txt) — the endpoint shortlist as we found it
- [`../.test_cases/test.py`](../.test_cases/test.py) — exploratory calls against the real API
- [`../.test_cases/trial_data/`](../.test_cases/trial_data/) — saved JSON responses used to design the DB schema

## Data flow

Every downstream call hangs off one root ID:

```
/campus?filter[city]=Warsaw
        │
        └─ campus_id ──┬─ /campus/{campus_id}/users
                        ├─ /blocs?filter[campus_id]=...  ──── coalition_id ─ /coalitions/{coalition_id}/coalitions_users
                        ├─ /cursus_users?filter[campus_id]=...
                        ├─ /campus/{campus_id}/locations?range[begin_at]=...
                        └─ /projects_users?filter[campus]=...&range[...]=...
```

## Endpoint inventory

| Endpoint | Purpose | Cadence we settled on |
| --- | --- | --- |
| `/campus?filter[city]=...` | Resolve `campus_id` from a human-readable city name | Monthly |
| `/campus/{campus_id}` | Campus profile (name, user count) | Monthly |
| `/campus/{campus_id}/users` | Full campus roster | Monthly |
| `/blocs?filter[campus_id]=...` | Coalitions for the campus | Weekly |
| `/coalitions/{coalition_id}/coalitions_users` | Per-coalition scores + ranks | Weekly |
| `/cursus_users?filter[campus_id]=...&filter[active]=true` | Active cursus memberships | Weekly |
| `/campus/{campus_id}/locations?range[begin_at]=...` | Logtime / on-campus activity | Weekly |
| `/projects_users?range[created_at]=...` / `range[updated_at]=...` | Projects started/updated in the window | Weekly |
| `/projects_users?range[marked_at]=...` | Projects **passed** in the window | Daily |
| `/campus/{campus_id}/achievements`, `/achievements/{id}/achievements_users` | Achievement catalogue + completions | Reference only — not on the live sync path |

Full mapping from each endpoint to its DB table and the read-only frontend
endpoint it feeds lives in [`ExecutionPlan.md`](ExecutionPlan.md).

## What the responses actually look like

Sampled from `trial_data/` (~1,550 real Warsaw users):

- **Campus** — flat object: `id`, `name`, `city`, `users_count`, plus nested `language`/`endpoint` blocks.
- **Users** — `id`, `login`, `first_name`/`last_name`, `image`, `pool_month`/`pool_year`, `staff?`.
- **Coalitions** (`/blocs`) — `coalition_id`, `campus_id`, `cursus_id`, `slug`, `color`, `score`.
- **Coalition users** — `coalition_id`, `user_id`, `score`, `rank`.
- **Locations** — `begin_at`, `end_at`, `host`, `campus_id`, nested `user`. This is the raw feed behind logtime and campus-attendance metrics.
- **Projects_users** — one shape reused for created/updated/passed windows: `status`, `final_mark`, `validated?`, `marked_at`, nested `project`/`user`/`teams`.
- **Cursus_users** — `cursus_id`, `grade`, `level`, `blackholed_at`, nested `user`/`cursus`.

Every list endpoint is paginated (`page[number]`, `page[size]`), capped at
`page[size]=100`; `test.py`'s `fetch_paginated_records` loop (walk pages
until a short page comes back) became the pattern the production
[`sync_support.fetch_paginated_records`](../sync_support.py) still uses.

## Platform limits we designed around

- **Hard caps:** 2 requests/second, 1,000 requests/hour.
- **Our margin:** the shared [`ApiRateLimiter`](../sync_support.py) throttles
  to 2 req/s and stops at 900 req/hour, leaving headroom instead of tripping
  the 429 threshold under real conditions.
- **Retries:** transient `429/500/502/503/504` responses get up to 5 attempts
  with exponential backoff before a sync job gives up.
- **Budget exhaustion is a first-class outcome, not an error path** — jobs
  save a cursor and resume next run instead of crashing (`ApiBudgetExceeded`).

## From research to production

This research became three tiers of scheduled sync instead of on-demand API
calls per dashboard request — see [`main.py`](../main.py) for the
coordinator and [`API_CONTRACT.md`](API_CONTRACT.md) for the resulting
read-only endpoints the frontend actually calls. Every dashboard request is
served from the local SQLite cache; nothing in the request path touches the
42 API directly.
