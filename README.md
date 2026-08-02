# 42-Warsaw-Hacks-ft-Riders
A simple dashboard for community and student stats and celebrating the little things.

## Backend (FastAPI + SQLite cache)

The backend now uses a cache-first design with a local SQLite database to reduce calls to the 42 API and survive upstream outages.

Detailed backend docs now live in:

- `backend/README.md`
- `backend/docs/API_CONTRACT.md`

### Backend structure

- `backend/main.py`: coordinator, database setup, scheduling, and app bootstrap
- `backend/long_term_sync.py`: long-term API calls for stable datasets
- `backend/short_term_sync.py`: short-term API calls for faster-moving datasets
- `backend/api_routes.py`: FastAPI route definitions and DB-backed reads
- `backend/sync_support.py`: shared API throttling, retries, and sync cursor helpers
- `backend/scripts/`: setup and smoke-test helpers
- `backend/docs/`: API contract and planning notes
- `backend/tests/`: automated backend tests
- `backend/.test_cases/`: manual API experiment scripts

- Database file: `backend/data/dashboard_cache.db`
- Long-term sync cadence: `30 days`
- Short-term sync cadence: `1 day`
- Coordinator poll loop: every `3600` seconds
- Primary campus source: `CAMPUS` environment variable (from `.env`)

### Run backend

From `backend/`:

```bash
chmod +x scripts/setup_backend.sh
./scripts/setup_backend.sh
```

Then start the server:

```bash
uvicorn main:app --reload --port 8000
```

Expose backend on LAN (for teammates on same network):

```bash
uvicorn main:app --host 0.0.0.0 --port 8025
```

### Endpoints

- `GET /health`
- `GET /api/v1/campus`
- `GET /api/v1/campus?force_refresh=true`
- `GET /api/v1/campus/{campus_id}`
- `GET /api/v1/campus/{campus_id}/history?points=30`
- `GET /api/v1/campus/{campus_id}/users`
- `GET /api/v1/campus/{campus_id}/coalitions`
- `GET /api/v1/campus/{campus_id}/coalitions/rankings?limit_per_coalition=10`
- `GET /api/v1/campus/{campus_id}/coalitions/top-scorers?limit_per_coalition=10`
- `GET /api/v1/campus/{campus_id}/coalitions/standings`
- `GET /api/v1/campus/{campus_id}/short-term-metrics`
- `GET /api/v1/campus/{campus_id}/users/logtime-top`
- `GET /api/v1/campus/{campus_id}/projects/passed-recent`
- `GET /api/v1/campus/{campus_id}/cursus/active-counts`
- `GET /api/v1/campus/{campus_id}/attendance/weekly`
- `GET /api/v1/campus/{campus_id}/projects/activity-weekly`
- `GET /api/v1/campus/{campus_id}/achievements/earned-weekly`
- `GET /api/v1/campus/{campus_id}/analytics/pills`
- `GET /api/v1/summary`
- `GET /api/v1/highlights?top_n=5`
- `POST /api/v1/refresh?scope=all|long_term|short_term`
- `POST /api/v1/refresh?scope=all|long_term|short_term&async_run=true`
- `GET /api/v1/refresh/status`

Responses include freshness metadata:

- `source_mode`: `fresh_cache`, `refreshed`, or `stale_fallback`
- `cache_age_seconds`
- `data_timestamp`

Refresh status includes job progress:

- `jobs.long_term.state`: `idle`, `running`, `completed`, `failed`
- `jobs.long_term.stage`: current phase (`fetch_campus`, `fetch_coalitions`, `fetch_campus_users`, `persist_cache`, etc.)
- `jobs.long_term.processed`, `jobs.long_term.total`, `jobs.long_term.failures`
- `jobs.long_term.last_error`

## Frontend (React + Vite)

The frontend now has a first dashboard shell with:

- animated top highlights carousel
- middle stat cards for key totals and cache state
- two rotating chart panels powered by Recharts
- polling against the FastAPI backend every 60 seconds

### Install and run frontend

From `frontend/`:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api/*` and `/health` to `http://127.0.0.1:8000` by default.
You can override it with `VITE_BACKEND_TARGET`, for example:

```bash
VITE_BACKEND_TARGET=http://127.0.0.1:8025 npm run dev
```

### Frontend environment

- Optional: `VITE_PRIMARY_CAMPUS_ID=67`
- Optional: `VITE_BACKEND_TARGET=http://127.0.0.1:8000`

This defaults to the cached Warsaw campus id if not provided.
