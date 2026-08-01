# NOTEBOOK

This is a working reference for the 42Warsaw dashboard, written so you can make
small tweaks yourself (colors, spacing, timing, copy, mock numbers) without
having to ask for each one. `README.md` is the "how to install and run" doc;
this file is the "what does each file do, and where do I go to change X" doc.
Update it as the project evolves — it's meant to stay useful, not to freeze in
time.

---

## 1. The big picture

Two independent projects live in this repo:

- **`backend/`** — a Python FastAPI server your teammate owns. It fetches
  campus data from the real 42 API, caches it in a local SQLite database, and
  exposes it as JSON over a few HTTP endpoints (`/api/v1/summary`,
  `/api/v1/campus/{id}/history`, etc). You generally don't need to touch this.
- **`frontend/`** — a React + Vite app (this is your area). It fetches JSON
  from the backend (or from local mock data, see §5) and renders it as the
  dashboard.

They only talk to each other over HTTP (`fetch()` calls to `/api/v1/...`,
proxied by Vite to `http://127.0.0.1:8000` in development — see
`frontend/vite.config.ts`). As far as the frontend is concerned, the backend
is just "a URL that returns JSON in a known shape." You can redesign
everything about how that JSON is displayed without knowing any Python.

---

## 2. File-by-file reference

### Root

| File | Responsible for |
|---|---|
| `README.md` | Install/run instructions for both backend and frontend. |
| `NOTEBOOK.md` | This file — the "what does X do" reference. |

### `backend/` (your teammate's area — for context only)

| File | Responsible for |
|---|---|
| `main.py` | The whole FastAPI app: DB setup, caching logic, and every `/api/v1/...` route. |
| `config.yml` / `config.sample.yml` | 42 API credentials/config for `main.py`. |
| `data/dashboard_cache.db` | SQLite cache — campus snapshots over time. |
| `data/campus.json`, `data/full_campus.json` | Fallback seed data if the DB is empty and the 42 API is unreachable. |
| `trial_data/*.json` | Sample payloads (coalition scores, log hours, users) — not currently wired into any endpoint, likely for future features. |

### `frontend/` — configuration

| File | Responsible for |
|---|---|
| `index.html` | The single HTML page Vite serves. Just a `<div id="root">` and a script tag pointing at `src/main.tsx`. You'd only edit this for `<title>`, favicon, or meta tags. |
| `vite.config.ts` | Dev server config. Sets up the React plugin and proxies `/api` and `/health` requests to the backend on port 8000 so `fetch('/api/v1/summary')` works without CORS issues in dev. |
| `package.json` | Dependencies (`react`, `framer-motion`, `recharts`, fonts) and npm scripts (`npm run dev`, `npm run build`, `npm run lint`). |
| `tsconfig*.json` | TypeScript compiler settings. You won't need to touch these. |
| `.env.local` | **Not committed to git** (matches `*.local` in `.gitignore`). Currently sets `VITE_USE_MOCK_DATA=true` so the app runs against fake data instead of the real backend. Delete this file, or change the value to `false`, to switch to live backend data. |
| `.oxlintrc.json` | Linter config for `npm run lint`. |

### `frontend/src/` — entry point and global styles

| File | Responsible for |
|---|---|
| `main.tsx` | React's entry point. Mounts `<App />` into the page and imports the Google-font-style packages (`@fontsource/newsreader`, `@fontsource/space-grotesk`) plus `index.css`. You'd touch this only to add a new global font or wrap the app in a new provider. |
| `index.css` | **Global design tokens**, defined once at the top as CSS custom properties (`:root { --bg-base: ...; }`) and used everywhere else via `var(--name)`. This is the single highest-leverage file for big visual changes — colors, fonts, base page background. See §4 below. |
| `App.tsx` | The top-level component. Handles: fetching dashboard data (real or mock), mobile vs. desktop layout switching, loading/error screens, and composing the three panels (`<StoriesPanel />`, `<GraphsPanel />`, `<StatsPanel />`). Also where the shared TypeScript types for backend responses live (`SummaryResponse`, `HistoryResponse`, etc.) |
| `App.css` | The **layout scaffold**: the `.stage` (full-viewport wrapper that draws the drifting background blobs), the `.dashboard-shell` (the grid that places Stories/Graphs/Stats and fills `.stage` edge-to-edge, using `fr` ratios so proportions hold at any size), the shared `.glass-panel` "liquid glass" style, the shared panel header/dots styling, and the mobile stacked-layout override. |

### `frontend/src/hooks/` — reusable logic (no visuals)

| File | Responsible for |
|---|---|
| `useIsMobile.ts` | Tracks whether the viewport is below the mobile breakpoint (760px by default) so `App.tsx` can switch to the stacked layout. |
| `useCarousel.ts` | Generic "auto-advance through N slides on a timer, but let something override the index" state hook. Used by both `GraphsPanel` (rotates charts) and `StatsPanel` (rotates heroes) so that logic isn't duplicated. |

### `frontend/src/components/` — the visual building blocks

| File | Responsible for |
|---|---|
| `Avatar.tsx` / `Avatar.css` | The Instagram-style ring avatar: an outer conic-gradient ring (always blue→purple→yellow, hardcoded per the brand spec), a white gap ring, and an inner colored circle with initials. Takes `size`, `ringWidth`, `gapWidth` as props so it can be reused at different scales (Stories row vs. Stats hero card). |
| `CarouselDots.tsx` | The small clickable dot row used to show/jump between carousel slides. Pure presentation — takes `count`, `activeIndex`, `onSelect`. |
| `StoriesPanel.tsx` / `.css` | The top bar. Renders `mockStudents` (see §3) as a horizontally-scrollable row of `<Avatar>` + first-name label. |
| `GraphsPanel.tsx` / `.css` | The bottom-left panel. Defines the 3 chart slides (milestone pie chart, weekday-hours bar chart, campus-history line chart) and cycles through them via `useCarousel`. This is where you'd add a 4th chart. |
| `StatsPanel.tsx` / `.css` | The bottom-right panel. Cycles through `mockHeroes` (see §3), each rendered as a big `<Avatar>` + name + gradient-text number. |

### `frontend/src/mocks/`

| File | Responsible for |
|---|---|
| `dashboardData.ts` | All the "made up data" in one place: `mockStudents` (Stories avatars), `mockMilestones` (pie chart), `mockWeekdayHours` (bar chart), `mockHeroes` (Stats cards), plus `mockSummary`/`mockHighlights`/`mockPrimaryCampus`/`mockHistory` which stand in for the real backend responses when `VITE_USE_MOCK_DATA=true`. This is the first place to look when you want to change what numbers/names appear on screen. |

---

## 3. Data flow, in one paragraph

`App.tsx` fetches four things on mount and every 60 seconds (`readJson()` calls
if `VITE_USE_MOCK_DATA` is false, otherwise the `mockDashboardData` object
after a fake 300ms delay). Of those four, only `history` is currently used —
it feeds the line-chart slide in `GraphsPanel`. Everything else on screen
(Stories avatars, pie chart, bar chart, hero cards) reads directly from the
hardcoded arrays in `mocks/dashboardData.ts`, because the backend doesn't have
endpoints for individual students, milestones, logged hours, or "hero of the
week" yet. When those endpoints exist, the swap is: replace the mock array
import with a `readJson<...>()` fetch in `App.tsx`, and pass the result down
as a prop instead of importing the mock directly into the panel component.

---

## 4. Design tokens — where "the look" lives

Defined in `frontend/src/index.css` (`:root { ... }`):

- `--bg-base`, `--bg-deep` — the dark page background gradient.
- `--accent-sun`, `--accent-orange`, `--accent-mint` — original accent colors (still used in a couple of older spots).
- `--brand-blue` (`#6FBBF9`), `--brand-purple` (`#AF38CA`), `--brand-yellow` (`#F7CF6E`) — the 42Warsaw brand colors (Lunaria Blue, Orionis Purple, Uniterrax Yellow), used for the avatar ring and gradient text.
- `--text-main`, `--text-muted`, `--text-faint` — text color hierarchy.
- `--font-body` (Space Grotesk), `--font-display` (Newsreader, the serif used for big numbers).

The "liquid glass" panel look lives in `frontend/src/App.css` as the shared
`.glass-panel` class (blur + translucency + inner highlight) and `.panel-float`
(the entrance animation + continuous idle bob). Every panel (`StoriesPanel`,
`GraphsPanel`, `StatsPanel`) uses both classes, so tweaking `.glass-panel` in
one place changes the look everywhere at once.

The overall canvas size and proportions (Stories = 20% height, Graphs = 66.7%
width, Stats = 33.3% width) are set in `App.css` under `.dashboard-shell` via
`grid-template-columns: 2fr 1fr` and `grid-template-rows: 1fr 4fr`.

---

## 5. Common tweaks — where to go

- **Change the color palette** → `frontend/src/index.css`, the `:root` block.
- **Change how "glassy" panels look** (blur amount, opacity, border) →
  `.glass-panel` in `frontend/src/App.css`.
- **Change the Stories/Graphs/Stats proportions** → `.dashboard-shell` in
  `frontend/src/App.css` (`grid-template-columns` / `grid-template-rows`).
- **Change avatar ring thickness or colors** → `frontend/src/components/Avatar.tsx`
  (the `RING_GRADIENT` constant and the `ringWidth`/`gapWidth` props passed by
  each caller).
- **Add/remove/rename mock students** → `mockStudents` in
  `frontend/src/mocks/dashboardData.ts`.
- **Change chart data or add a 4th chart slide** → `frontend/src/components/GraphsPanel.tsx`
  (the `slides` array) and the corresponding mock arrays in `dashboardData.ts`.
- **Change carousel speed** → the second argument to `useCarousel(...)` in
  `GraphsPanel.tsx` (currently `7000`ms) or `StatsPanel.tsx` (currently `6500`ms).
- **Change the mobile breakpoint** → `760` passed to `useIsMobile(760)` in
  `App.tsx`, and the matching `@media (max-width: 760px)` in `App.css`.
- **Switch between mock data and the real backend** → toggle
  `VITE_USE_MOCK_DATA` in `frontend/.env.local` (`true`/`false`), then restart
  `npm run dev`.
- **Run the app** → `cd frontend && npm run dev`, open the printed
  `localhost` URL. Hot-reloads on save.

---

## 6. Open questions / things we're mid-iteration on

_(Keep this section updated as we go — it's the "what's still in flux" list.)_

- Stories/Graphs/Stats proportions: confirmed at 20%/66.7%/33.3%, open to
  adjustment based on how it looks at 1920×1080.
- Glass effect strength: first pass, may need more/less blur.
- No real student photos yet — avatars are colored-initial placeholders.
- **Decided:** the dashboard is a passive, no-interaction display (kiosk-style
  — nobody is meant to touch/click it). There is no hover or tap feedback
  anywhere in the app on purpose. If you add new components, don't add
  `:hover`/`:active` CSS or `whileHover`/`whileTap` framer-motion props.
- **Decided:** Stories avatars are `<div>`s, not `<button>`s — they aren't
  clickable, so they shouldn't carry button semantics.
- Stories bar tuning applied: ring+gap width `4.8px` each (was 12px), avatar
  size `110px` (was 92px), name text `1.404rem` (was 0.78rem), row gap
  (tune it to taste in `StoriesPanel.css`), row is horizontally centered, and
  the scrollbar is hidden (still scrollable via `overflow-x: auto` if the row
  overflows, just no visible scrollbar chrome).
- **Fixed:** the dashboard used to render at a literal fixed 1920×1080 size
  and scale itself down with `transform: scale()` to fit inside whatever
  browser window it was in — centered by `.stage`'s flexbox, which is what
  caused visible margins ("huge padding") on all sides whenever the real
  browser viewport was smaller than 1920×1080 (which it always is in a
  normal windowed browser, since browser chrome eats vertical space). Fixed
  by making `.dashboard-shell` fill `.stage` directly (`width: 100%; height:
  100%`) instead of scaling a fixed-size box — it now always reaches the true
  edges of the viewport, with only its own small `padding: 28px` visible.
  The `useFitScale` hook and `useFitToViewport.ts` file were removed as a
  result (dead code); `useIsMobile` moved to its own `useIsMobile.ts` file.
  Trade-off: content sized in fixed px (avatar sizes, chart heights, font
  sizes) no longer auto-shrinks together on narrow desktop windows between
  the mobile breakpoint (760px) and ~1920px — only true mobile (<760px) gets
  a dedicated layout. Worth revisiting if this needs to look right on
  in-between window sizes, not just near-1920px or <760px.
