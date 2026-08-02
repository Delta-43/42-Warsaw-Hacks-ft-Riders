# Backend Setup

## Quick Start

From `backend/`:

```bash
chmod +x scripts/setup_backend.sh
./scripts/setup_backend.sh
```

Then fill in:

- `backend/config.yml` with your 42 API credentials
- optionally `backend/.env` for local overrides

Start the API server:

```bash
cd backend
./.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

## Smoke Test A Running Server

```bash
cd backend
./.venv/bin/python scripts/smoke_test_backend.py --base-url http://127.0.0.1:8000 --campus-id 67
```

This script only reads cache-backed endpoints. It does not force refreshes.

## API Documentation

Frontend endpoint contract:

- `backend/docs/API_CONTRACT.md`

Planning notes:

- `backend/docs/Notes.md`
- `backend/docs/ExecutionPlan.md`

## Deployment Notes

- Python `3.10+` recommended
- Uses a local SQLite cache at `backend/data/dashboard_cache.db`
- `requirements.txt` is pinned for reproducible installs
- `scripts/setup_backend.sh` creates `.venv`, installs dependencies, and scaffolds missing local config files
- Background sync is coordinated by the FastAPI app process itself
- The active achievement metric is only the weekly earned count. The older achievement coverage API is not part of the maintained frontend contract.

## Backend Tree

- `api_routes.py`, `main.py`, `long_term_sync.py`, `short_term_sync.py`, `sync_support.py`: runtime backend code
- `config.yml`, `config.sample.yml`, `.env`, `.env.example`: local configuration files
- `data/`: SQLite cache and runtime data
- `docs/`: API contract and planning notes
- `scripts/`: setup and smoke-test helpers
- `tests/`: automated backend tests
- `.test_cases/`: manual experiment scripts kept separate from automated tests

## About The Test Warning

You may see a deprecation warning from `fastapi.testclient` mentioning `httpx2`.

That warning affects local test tooling, not the production API server path. It is safe to defer unless we decide to refactor the test stack later.
