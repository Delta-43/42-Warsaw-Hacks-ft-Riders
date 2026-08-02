# API Baseline Notes

This file is the working baseline for the project. It combines the endpoint list from `apis to work with.txt` with the example calls and payload shapes in `test.py` and `trial_data/`.

## Data Flow

1. Get the campus by city.
2. Use the campus id to pull all campus-scoped data.
3. Use bloc and coalition ids to pull coalition details.
4. Use date ranges to refresh time-based activity data.

## Endpoint Inventory

| Endpoint | Why we call it | Typical return shape | Refresh cadence |
| --- | --- | --- | --- |
| `/campus?filter[city]=...` | Resolve the active campus and its `campus_id` | List with one campus object, including nested language and endpoint details | Monthly |
| `/campus/{campus_id}/users` | Get all users in the selected campus | List of user objects | Monthly |
| `/blocs?filter[campus_id]=...` | Get the coalitions available in the campus | List with bloc objects, usually containing coalition metadata | Monthly |
| `/coalitions/{coalition_id}/coalitions_users` | Get the users and scores for each coalition | List of coalition user / score records | Weekly |
| `/projects_users?filter[campus]=...&range[created_at]=start,end` | Measure projects started in the last 7 days | List of project-user records with nested project, user, and team data | Weekly |
| `/projects_users?filter[campus]=...&range[updated_at]=start,end` | Measure projects updated in the last 7 days | Same project-user record structure as above | Weekly |
| `/projects_users?filter[campus]=...&range[marked_at]=start,end` | Capture recently passed projects | Same project-user record structure, filtered by pass time | Daily / every 24 hours |
| `/cursus_users?filter[campus_id]=...&filter[active]=true` | Get active cursus memberships for the campus | List of cursus-user records | Weekly |
| `/campus/{campus_id}/locations?range[begin_at]=start,end` | Track logins / location activity over the last 7 days | List of location records | Weekly |
| `/campus/{campus_id}/achievements` | List campus achievements | List of achievement objects | Reference endpoint for now |
| `/achievements/{achievement_id}/achievements_users` | Count achievement completions per achievement | List of achievement-user records | Reference endpoint for now |

## Return Shapes We Have Already Seen

- Campus payloads come back as a JSON array. Each campus object includes fields like `id`, `name`, `city`, `users_count`, and nested `language` and `endpoint` objects.
- Coalition payloads come back as a JSON array. Each record includes `coalition_id`, `campus_id`, `cursus_id`, `name`, `slug`, `color`, and `score`.
- Project-user payloads come back as a JSON array. Each record includes project status fields and nested `project`, `user`, and `teams` data.

## Time Windows

- Monthly refresh: campus discovery, campus users, blocs.
- Weekly refresh: coalition users, project activity for the last 7 days, active cursus users, and locations for the last 7 days.
- Daily refresh: passed projects in the last 24 hours.

## Notes For The Next Plan

- `campus_id` is the root key for most downstream requests.
- `coalition_id` comes from the bloc response and drives coalition member fetches.
- `achievement_id` is only needed if we decide to include the achievement counts in the plan.
- The saved `trial_data/` files are the quickest reference for actual payload shapes while we rebuild the execution plan.