# 42-Warsaw-Hacks-ft-Riders
A simple dashboard for community and student stats and celebrating the little things.

## Backend (FastAPI + SQLite cache)

The backend now uses a cache-first design with a local SQLite database to reduce calls to the 42 API and survive upstream outages.

- Database file: `backend/data/dashboard_cache.db`
- Cache TTL: `600` seconds
- Auto refresh loop: every `600` seconds
- Fallback seed: `backend/data/campus.json` (used only if DB is empty)

### Run backend

From `backend/`:

```bash
uvicorn main:app --reload --port 8000
```

### Endpoints

- `GET /health`
- `GET /api/v1/campus`
- `GET /api/v1/campus?force_refresh=true`
- `GET /api/v1/campus/{campus_id}`
- `GET /api/v1/campus/{campus_id}/history?points=30`
- `GET /api/v1/summary`
- `GET /api/v1/highlights?top_n=5`
- `POST /api/v1/refresh`

Responses include freshness metadata:

- `source_mode`: `fresh_cache`, `refreshed`, or `stale_fallback`
- `cache_age_seconds`
- `data_timestamp`

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

The Vite dev server proxies `/api/*` and `/health` to `http://127.0.0.1:8000`, so run the backend on port `8000` during development.

### Frontend environment

- Optional: `VITE_PRIMARY_CAMPUS_ID=67`

This defaults to the cached Warsaw campus id if not provided.
