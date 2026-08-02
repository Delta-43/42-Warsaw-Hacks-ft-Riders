# Frontend ↔ Backend Integration Plan

Written from the `live-data-integration` branch (Frontend-Design merged with the
teammate's completed backend delivery on `main`). This is the "what's different,
what's missing, how do we merge it" reference for wiring the dashboard UI to
real data. Source of truth for endpoint shapes below is `backend/api_routes.py`
itself (read directly, not just `backend/docs/API_CONTRACT.md`), cross-checked
against `backend/tests/test_api_routes_metrics.py`.

---

## 1. Where things stand

- `Frontend-Design`: the full visual redesign (Stories speech-bubble carousel,
  pastel wave background, unified avatar rings, eyebrow headers). Fully mock-data
  driven except the one line chart (see §3).
- `main` (now pulled into `live-data-integration`): a complete rewrite of the
  backend since the last time frontend merged it — cache-backed endpoints for
  coalitions, logtime, project passes, cursus counts, attendance, weekly project
  activity, and achievements, all documented in `backend/docs/API_CONTRACT.md`.
- `live-data-integration`: merge of the two, no conflicts. This is the branch to
  build the real integration on.
- There's also a second, older, unrelated attempt at wiring live data sitting in
  `main`'s own `App.tsx` (a different prototype UI, pre-dates the current visual
  design and pre-dates the backend's current contract — it calls
  `achievements/coverage`, which the backend README explicitly says is no longer
  part of the maintained contract). Our merge already keeps `Frontend-Design`'s
  `App.tsx`, so that old prototype is fully superseded — mentioned here only so
  nobody goes looking for it as a reference.

## 2. Full backend endpoint inventory (ground truth from source)

| Endpoint | Returns | Notes |
|---|---|---|
| `GET /health` | `{status, service, time}` | |
| `GET /api/v1/campus` | `{source_mode, cache_age_seconds, data_timestamp, items[]}` | all campuses |
| `GET /api/v1/campus/{id}` | `{source_mode, cache_age_seconds, data_timestamp, campus{id,name,city,country,users_count,collected_at,source_status}}` | |
| `GET /api/v1/campus/{id}/history?points=N` | `{..., campus{id,name}, points, history[]{users_count,collected_at,source_status}}` | |
| `GET /api/v1/campus/{id}/users?limit=N` | `{source_mode, data_timestamp, users[]}` | |
| `GET /api/v1/campus/{id}/coalitions` | `{source_mode, data_timestamp, coalitions{...}}` | coalition ref + latest score |
| `GET /api/v1/campus/{id}/short-term-metrics?limit=N` | `{source_mode, data_timestamp, metrics[]}` | raw metric snapshots |
| `GET /api/v1/campus/{id}/analytics/pills` | `{analytics:{campus_id, users:{total,active,active_ratio}, achievements:{earned_this_week}, coalition_scores:{avg_user_score,top_user_score,ranked_users}}}` | |
| `GET /api/v1/campus/{id}/coalitions/rankings?limit_per_coalition=N` | `{rankings:{campus_id,total,items[]}}` | per-user rank within each coalition |
| `GET /api/v1/campus/{id}/coalitions/top-scorers?limit_per_coalition=N` | `{top_scorers:{campus_id,total,items[]{coalition_id,user_id,score,rank,coalition_name,slug,color,login,first_name,last_name}}}` | same underlying data as `rankings`, different key name |
| `GET /api/v1/campus/{id}/coalitions/standings` | `{standings:{campus_id,total,items[]{coalition_id,coalition_name,slug,image_url,cover_url,color,score,score_collected_at}}}` | coalition-level totals |
| `GET /api/v1/campus/{id}/users/logtime-top?limit=N` | `{logtime_rankings:{campus_id,week_start_date,total,items[]{user_id,seconds_logged,sessions_count,login,first_name,last_name,image_url,hours_logged}}}` | **has real profile photo URLs** |
| `GET /api/v1/campus/{id}/projects/passed-recent?hours=24&limit=200` | `{future_capability{...}, projects_passed_recent:{campus_id,window_hours,total,items[]{user_id,project_id,project_name,marked_at,user_login,user_image_url,user_profile_url}}}` | **has real profile photo URLs** |
| `GET /api/v1/campus/{id}/cursus/active-counts` | `{active_cursus_counts:{campus_id,total,items[]{cursus_id,cursus_name,active_users_count}}}` | per-cursus, not per-milestone |
| `GET /api/v1/campus/{id}/attendance/weekly` | `{attendance:{campus_id,week_start_date,unique_students_count}}` | single number |
| `GET /api/v1/campus/{id}/projects/activity-weekly` | `{project_activity:{campus_id,week_start_date,active_or_started_projects_count,created_events_count,updated_events_count}}` | single week total, not a daily series |
| `GET /api/v1/campus/{id}/achievements/earned-weekly` | `{weekly_achievements_earned:{metric_name,metric_value,collected_at,source_status,payload}}` | single number |
| `GET /api/v1/summary` | `{summary:{total_campuses,total_users,top_campus{id,name,users_count}}}` | |
| `GET /api/v1/highlights?top_n=5` | `{highlights:{top_count,items[]{id,name,city,country,users_count,users_delta_since_prev}}}` | |
| `POST /api/v1/refresh?scope=all\|long_term\|short_term` | sync trigger | not for dashboard display |
| `GET /api/v1/refresh/status` | job status | debug/admin only |

**Every cached endpoint carries `source_mode` (`fresh_cache`/`refreshed`/`budget_limited`/`stale_fallback`) and `data_timestamp`.**

## 3. What the frontend currently fetches vs. what's still 100% mock

`App.tsx` already fetches four things (real endpoints, toggled by `VITE_USE_MOCK_DATA`):

| Frontend type | Endpoint | Match? |
|---|---|---|
| `SummaryResponse` | `/api/v1/summary` | ✅ exact field-for-field match, confirmed against `build_summary()` |
| `HighlightsResponse` | `/api/v1/highlights` | ✅ exact match, confirmed against `build_highlights()` |
| `CampusResponse` | `/api/v1/campus/{id}` | ✅ exact match, confirmed against `get_latest_snapshot()` |
| `HistoryResponse` | `/api/v1/campus/{id}/history` | ✅ exact match, confirmed against `get_campus_history()` — this is the one already driving the Graphs line chart |

Good news: nothing needs to change here. These four can go live today by flipping
`VITE_USE_MOCK_DATA=false` once the backend is confirmed running.

**Correction after reading `App.tsx` closely:** only `history` is actually
rendered anywhere (it feeds `historySeries` into the Graphs line chart).
`summary` and `highlights` are fetched every poll cycle and then never passed
to any panel — dead fetches today. Worth deciding whether to give them a home
(e.g. `analytics/pills` could replace `summary` with a richer single call, see
§5) or drop the unused fetches.

Everything else on screen is still hardcoded mock data with **no wiring to any
endpoint at all**, because these mock shapes were invented before the backend
contract existed:

| Mock file | Feeds | Fields the UI assumes |
|---|---|---|
| `Stories/students.mock.ts` | Stories carousel (16 students) | `name, initials, colorFrom/To, intraLogin, xp, wallet, lastProject` |
| `Graphs/graphs.mock.ts` | pie chart "Students per milestone" | `milestone (M0-M7), students` count |
| `Graphs/graphs.mock.ts` | bar chart "Hours logged this week" | `day (Mon-Sun), hours` |
| `Stats/heroes.mock.ts` | Stats "Hero of the week" (3 cards) | `category, name, value, unit, initials` — categories are "Most hours logged", "Most XP earned", "Most Altarian Dollars" |

## 4. Gap analysis — can each mock be replaced, and with what?

### Stories carousel — partially replaceable, needs a data-model change

Real per-user activity data exists (`users/logtime-top`, `projects/passed-recent`,
`coalitions/top-scorers`) and — bonus — **all three carry a real profile photo
URL**, which closes the "no real student photos yet" gap noted in the old
NOTEBOOK.md.

But the current design assumes a fixed roster of "students" cycling through in
order. Real data instead gives **activity events** (who logged the most time
this week, who just passed a project, who's topping a coalition). Two fields in
the speech bubble have **no backend source at all**:

- `xp` — no endpoint anywhere exposes an XP number.
- `wallet` ("$") — no endpoint anywhere exposes wallet/Altarian Dollars.

**Recommendation:** re-scope the Stories carousel from "roster of students" to
"recent activity feed" — cycle through `projects/passed-recent` (real, recent,
naturally time-ordered — fits "recently completed X" in the bubble almost
verbatim) merged with `users/logtime-top` for the odd slot. Drop `xp`/`wallet`
from the bubble text, or replace with `hours_logged`/`seconds_logged`, which
*is* real.

### Pie chart "Students per milestone" — no equivalent, needs redesign

No endpoint breaks users down by milestone/level. The closest real data is
`cursus/active-counts` (active users **per cursus**, e.g. "42cursus" vs
"Piscine" — a different, coarser axis than milestones). Two options:

1. Repurpose the pie chart to show cursus breakdown instead of milestones.
2. Drop the chart and use that carousel slot for something with real data
   (e.g. coalition standings, see below).

### Bar chart "Hours logged this week" — no daily series, needs redesign

No endpoint gives a day-by-day (Mon–Sun) hours breakdown — `attendance/weekly`
and `projects/activity-weekly` are single weekly totals, and `users/logtime-top`
is per-user, not per-day. **Recommendation:** repurpose the bar chart to show
top-10 logtime leaders (`users/logtime-top`, one bar per student) instead of a
day-of-week series — this is real, ranked, and visually similar (a bar chart is
a bar chart either way).

### Line chart "42Warsaw student count trend" — already real, no change needed

Already wired to `/api/v1/campus/{id}/history`. Keep as-is.

### Stats "Hero of the week" — 1 of 3 categories is real as-is

- "Most hours logged" → `users/logtime-top`, rank #1. Real, direct match.
- "Most XP earned" → no XP endpoint exists. Needs replacing.
- "Most Altarian Dollars" → no wallet endpoint exists. Needs replacing.

**Recommendation:** replace the XP and wallet categories with real leaderboard
data that exists today — e.g. "Top coalition scorer" (`coalitions/top-scorers`,
rank #1) and "Most projects passed this week" (derivable by counting
`projects/passed-recent` per user).

### Bonus find: the real coalition names/colors already match the frontend's brand palette

`/coalitions/standings` returns real coalitions **Lunaria** (`#52BDFF`),
**Orionis** (`#BE2AD1`), **Uniterrax** (`#FFCD5A`) — these are exactly the
`--brand-blue`/`--brand-purple`/`--brand-yellow` values already hardcoded in
`Global/styles.css`, and match the names in the old NOTEBOOK.md ("Lunaria
Blue, Orionis Purple, Uniterrax Yellow"). The avatar ring gradient and the
`heroes.mock.ts` "Ⱥ$ Altarian Dollars" flavor text were clearly designed around
these three real coalitions already — a coalition-standings visual would slot
into the existing palette with zero new colors needed.

## 5. Endpoints with no frontend surface yet (opportunities, not gaps)

These are fully built and cache-backed but nothing on screen uses them today:

- `coalitions/standings` — coalition-level totals + brand colors, would suit a
  new standings-style visual.
- `attendance/weekly` — a single "N students on campus this week" number, good
  stat-tile material.
- `analytics/pills` — a pre-aggregated summary bundle (`users.total`,
  `users.active`, `active_ratio`, `achievements.earned_this_week`,
  `coalition_scores.*`) that could replace several separate fetches with one
  call if the dashboard wants a compact overview strip.

## 6. Proposed refactor order

1. **No-risk first step:** flip `VITE_USE_MOCK_DATA=false`, confirm the summary/
   highlights/campus/history-backed line chart renders against the real backend
   unchanged.
2. Redesign the Stories carousel's data model around `projects/passed-recent` +
   `users/logtime-top` (real photos, drop `xp`/`wallet`).
3. Repurpose the bar chart to logtime leaders (`users/logtime-top`).
4. Decide pie chart's fate: cursus breakdown vs. replaced by coalition standings.
5. Replace 2 of 3 Hero-of-the-week categories with coalition/project-pass data.
6. Revisit `analytics/pills` as a possible consolidation once the above is
   stable — lower priority, an optimization not a blocker.

## 7. Open questions for the team

- Is an XP or wallet number coming from the 42 API at all, or should the design
  stop assuming it permanently?
- Is per-milestone breakdown worth a future backend endpoint, or should the pie
  chart concept be retired in favor of coalition standings?
- Confirm campus id `67` (Warsaw) stays the default — matches both
  `frontend/.env.local` (`VITE_PRIMARY_CAMPUS_ID`, defaults to 67 anyway) and
  backend `.env` (`CAMPUS=67`).

---

## 8. Live verification results

Ran against a real local instance (`uvicorn main:app`, Python 3.14, real
`backend/data/dashboard_cache.db` — 1,554 real Warsaw users, not synthetic
fixtures), not just source-reading.

**Automated test suite** (`pytest tests/`, fully self-contained, no live 42 API
credentials needed — seeds its own temp DB): **8/9 passed.**

- 1 failure: `test_coalition_alias_endpoints` expects `/coalitions/standings`
  to return `total: 1` after seeding one coalition, but got `total: 3`.
  Root-caused by hand: replaying the exact same seed steps in isolation
  correctly produces `total: 1`, and the live server (real cache, which
  legitimately has exactly 3 real coalitions) also correctly returns `3`. So
  the query logic itself is right — real data confirms it. The test only fails
  when run as part of the full 9-test file in one pytest process, which points
  to a test-isolation leak (something not getting reset between `TestClient`
  instances across test functions in that file) rather than a live-endpoint
  bug. **Not a blocker for frontend integration** — flagging for the backend
  owner to fix the test, not the route.

**Official smoke test** (`scripts/smoke_test_backend.py`, cache-only, no forced
refreshes): **all 11 checks passed**, every one `fresh_cache` or `db_cache`.
Sample output:
```
[200] coalition standings: fresh_cache
[200] weekly logtime: fresh_cache
[200] recent project passes: fresh_cache
[200] analytics pills: db_cache
{
  "weekly_achievements_earned": 83.0,
  "analytics_earned_this_week": 83,
  "users_logtime_total": 1551
}
```

**Manual verification of the 4 endpoints the frontend already calls**
(`/api/v1/summary`, `/api/v1/highlights`, `/api/v1/campus/67`,
`/api/v1/campus/67/history`) — all four returned `200`, all four match our
`SummaryResponse`/`HighlightsResponse`/`CampusResponse`/`HistoryResponse`
TypeScript types **exactly**, field for field, against real data (1,554 users,
real timestamps, `source_status: "live_api"`).

**Manual verification of the new endpoints proposed in §4** — `users/logtime-top`
and `projects/passed-recent` both confirmed to return real, working
`cdn.intra.42.fr` profile photo URLs (not placeholders), e.g.
`https://cdn.intra.42.fr/users/.../mafzal.jpg`. `cursus/active-counts` returned
11 real cursus rows (42cursus: 303 active, C Piscine: 28, then a long tail of
1-6 each) — confirms the "repurpose the pie chart to cursus breakdown" idea in
§4 is viable but will need a top-N-plus-other grouping, since most cursus
entries are in the single digits.

No server errors in the uvicorn log across the whole session — every request
came back `200 OK`.

## 9. Outstanding process note

Pushing `Frontend-Design` to `origin` failed in this sandboxed session — no
interactive credential prompt is available here (`gh` isn't installed, and
there's no cached GitHub credential). The commit exists locally; someone needs
to run `git push -u origin Frontend-Design` (and eventually push
`live-data-integration`) from an environment with GitHub auth, or set up
`gh auth login` interactively first.
