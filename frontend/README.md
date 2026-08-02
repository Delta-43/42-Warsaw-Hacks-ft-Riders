# Frontend (React + TypeScript + Vite)

The dashboard shell: an animated top highlights carousel, a middle metrics
island, and two rotating chart/stats panels (Recharts), polling the FastAPI
backend every 60 seconds.

## Install and run

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api/*` and `/health` to `http://127.0.0.1:8000`
by default. Point it at a different backend (e.g. a Railway deploy or an
ngrok tunnel) with `VITE_BACKEND_TARGET`:

```bash
VITE_BACKEND_TARGET=http://127.0.0.1:8025 npm run dev
```

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_BACKEND_TARGET` | Dev-server proxy target for `/api/*` and `/health` | `http://127.0.0.1:8000` |
| `VITE_API_BASE_URL` | Backend base URL baked into a static build (GitHub Pages) | *(empty — same-origin)* |
| `VITE_PRIMARY_CAMPUS_ID` | Fallback campus id, only used if `GET /api/v1/config` is unreachable | `67` |
| `VITE_BASE_PATH` | Asset base path for subpath hosting (set by the deploy workflow) | `/` |
| `VITE_USE_MOCK_DATA` | Set to `true` to render with bundled mock data, no backend required | `false` |

The primary campus id is normally fetched at runtime from the backend's
`GET /api/v1/config` — see [`backend/docs/API_CONTRACT.md`](../backend/docs/API_CONTRACT.md).
`VITE_PRIMARY_CAMPUS_ID` only matters as a fallback if that call fails.

## Working without a backend

```bash
VITE_USE_MOCK_DATA=true npm run dev
```

Useful for UI-only iteration (layout, styling, animations) without needing
the FastAPI backend or a 42 API config running locally.

## Build

```bash
npm run build   # tsc -b && vite build
npm run preview # serve the production build locally
```

## Linting

```bash
npm run lint   # oxlint
```

If you are developing a production application, we recommend enabling
type-aware lint rules by installing `oxlint-tsgolint` and editing
`.oxlintrc.json` — see the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules).
