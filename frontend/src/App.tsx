import {
  type ReactElement,
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const PRIMARY_CAMPUS_ID = Number(import.meta.env.VITE_PRIMARY_CAMPUS_ID ?? 67)
const POLL_INTERVAL_MS = 60_000

type SourceMode = 'fresh_cache' | 'refreshed' | 'stale_fallback'

type SummaryResponse = {
  source_mode: SourceMode
  cache_age_seconds: number | null
  data_timestamp: string | null
  summary: {
    total_campuses: number
    total_users: number
    top_campus: {
      id: number
      name: string
      users_count: number
    } | null
  }
}

type Highlight = {
  id: number
  name: string
  city: string
  country: string
  users_count: number
  users_delta_since_prev: number
}

type HighlightsResponse = {
  source_mode: SourceMode
  cache_age_seconds: number | null
  data_timestamp: string | null
  highlights: {
    top_count: number
    items: Highlight[]
  }
}

type CampusResponse = {
  source_mode: SourceMode
  cache_age_seconds: number | null
  data_timestamp: string | null
  campus: {
    id: number
    name: string
    city: string
    country: string
    users_count: number
    collected_at: string
    source_status: string
  }
}

type HistoryPoint = {
  users_count: number
  collected_at: string
  source_status: string
}

type HistoryResponse = {
  source_mode: SourceMode
  cache_age_seconds: number | null
  data_timestamp: string | null
  campus: {
    id: number
    name: string
  }
  points: number
  history: HistoryPoint[]
}

type DashboardData = {
  summary: SummaryResponse
  highlights: HighlightsResponse
  primaryCampus: CampusResponse
  history: HistoryResponse
}

type ChartView = {
  id: string
  eyebrow: string
  title: string
  description: string
  chart: ReactElement
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Request failed for ${path} with status ${response.status}`)
  }
  return (await response.json()) as T
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatFullNumber(value: number) {
  return new Intl.NumberFormat('en').format(value)
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'No snapshot yet'
  }
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function sourceModeLabel(mode: SourceMode) {
  if (mode === 'stale_fallback') {
    return 'Stale cache'
  }
  if (mode === 'refreshed') {
    return 'Freshly refreshed'
  }
  return 'Cache live'
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [chartRotation, setChartRotation] = useState(0)

  const fetchDashboard = useEffectEvent(async () => {
    const [summary, highlights, primaryCampus, history] = await Promise.all([
      readJson<SummaryResponse>('/api/v1/summary'),
      readJson<HighlightsResponse>('/api/v1/highlights?top_n=6'),
      readJson<CampusResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}`),
      readJson<HistoryResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/history?points=24`),
    ])

    startTransition(() => {
      setDashboard({ summary, highlights, primaryCampus, history })
      setError(null)
      setLoading(false)
    })
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        await fetchDashboard()
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard data')
          setLoading(false)
        }
      }
    }

    void load()

    const intervalId = window.setInterval(() => {
      void load()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!dashboard?.highlights.highlights.items.length) {
      return
    }

    const intervalId = window.setInterval(() => {
      setCarouselIndex((currentIndex) => {
        const total = dashboard.highlights.highlights.items.length
        return (currentIndex + 1) % total
      })
    }, 4500)

    return () => window.clearInterval(intervalId)
  }, [dashboard])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setChartRotation((currentIndex) => currentIndex + 1)
    }, 5200)

    return () => window.clearInterval(intervalId)
  }, [])

  const highlightItems = useMemo(
    () => dashboard?.highlights.highlights.items ?? [],
    [dashboard?.highlights.highlights.items],
  )
  const activeHighlight = highlightItems[carouselIndex] ?? null

  const historySeries = useMemo(() => {
    return (dashboard?.history.history ?? []).map((point) => ({
      label: formatShortTime(point.collected_at),
      users: point.users_count,
      snapshot: point.source_status,
    }))
  }, [dashboard?.history.history])

  const leaderboardSeries = useMemo(() => {
    return highlightItems.map((item) => ({
      name: item.name,
      users: item.users_count,
      delta: item.users_delta_since_prev,
    }))
  }, [highlightItems])

  const overviewStats = useMemo(() => {
    if (!dashboard) {
      return []
    }

    const warsawUsers = dashboard.primaryCampus.campus.users_count
    const totalUsers = dashboard.summary.summary.total_users
    const shareOfGlobal = totalUsers > 0 ? (warsawUsers / totalUsers) * 100 : 0
    const topHighlight = dashboard.highlights.highlights.items[0]

    return [
      {
        label: 'Total network',
        value: formatFullNumber(totalUsers),
        detail: `${dashboard.summary.summary.total_campuses} campuses tracked`,
      },
      {
        label: '42Warsaw',
        value: formatFullNumber(warsawUsers),
        detail: `${shareOfGlobal.toFixed(1)}% of tracked users`,
      },
      {
        label: 'Top campus now',
        value: topHighlight?.name ?? 'No data',
        detail: topHighlight ? `${formatCompactNumber(topHighlight.users_count)} students` : 'Awaiting refresh',
      },
      {
        label: 'Data freshness',
        value: sourceModeLabel(dashboard.summary.source_mode),
        detail: `Snapshot ${formatTimestamp(dashboard.summary.data_timestamp)}`,
      },
    ]
  }, [dashboard])

  const chartViews = useMemo<ChartView[]>(() => {
    if (!dashboard) {
      return []
    }

    return [
      {
        id: 'warsaw-line',
        eyebrow: 'Timeline',
        title: '42Warsaw student count trend',
        description: 'The primary campus history panel is already wired to SQLite snapshots, so new refreshes will naturally extend this chart.',
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historySeries}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tickLine={false} axisLine={false} width={60} />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#ff9f43" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ),
      },
      {
        id: 'warsaw-area',
        eyebrow: 'Pulse',
        title: '42Warsaw snapshot build-up',
        description: 'This area view emphasizes accumulation and gives you a more atmospheric hero-style metric for the lower graph zone.',
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historySeries}>
              <defs>
                <linearGradient id="warsawGlow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#ffd166" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#ffd166" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tickLine={false} axisLine={false} width={60} />
              <Tooltip />
              <Area type="monotone" dataKey="users" stroke="#ffd166" fill="url(#warsawGlow)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        ),
      },
      {
        id: 'leaders-bar',
        eyebrow: 'Leaders',
        title: 'Largest campuses in the current cache',
        description: 'This is a strong default for the first bottom chart while you are still curating more specific school KPIs.',
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leaderboardSeries} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={92} />
              <Tooltip />
              <Bar dataKey="users" fill="#4ecdc4" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ),
      },
      {
        id: 'delta-bar',
        eyebrow: 'Momentum',
        title: 'Change since previous snapshot',
        description: 'As your cache accumulates more snapshots, this view becomes a compact indicator of which campuses are moving fastest.',
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leaderboardSeries}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={60} />
              <YAxis tickLine={false} axisLine={false} width={52} />
              <Tooltip />
              <Bar dataKey="delta" fill="#ff6b6b" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ),
      },
    ]
  }, [dashboard, historySeries, leaderboardSeries])

  const leftChart = chartViews[chartRotation % Math.max(chartViews.length, 1)]
  const rightChart = chartViews[(chartRotation + 2) % Math.max(chartViews.length, 1)]

  if (loading) {
    return (
      <main className="dashboard-shell loading-state">
        <section className="loading-card">
          <p className="eyebrow">Booting dashboard</p>
          <h1>Preparing the first 42Warsaw community view.</h1>
          <p>Fetching summary, highlights, and Warsaw snapshot history from the FastAPI cache.</p>
        </section>
      </main>
    )
  }

  if (error || !dashboard) {
    return (
      <main className="dashboard-shell loading-state">
        <section className="loading-card error-card">
          <p className="eyebrow">Frontend can reach Vite, but data is missing</p>
          <h1>Dashboard data request failed.</h1>
          <p>{error ?? 'Unknown error'}</p>
          <a className="inline-link" href="http://127.0.0.1:8000/api/v1/summary" target="_blank" rel="noreferrer">
            Check backend summary endpoint
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">42Warsaw student community dashboard</p>
          <h1>Static shell, live campus pulse.</h1>
          <p className="hero-text">
            This first frontend pass already consumes your FastAPI cache and turns it into an animated overview for highlights, steady metrics, and chart-ready campus history.
          </p>
          <div className="hero-meta-row">
            <span className={`status-pill status-${dashboard.summary.source_mode}`}>
              {sourceModeLabel(dashboard.summary.source_mode)}
            </span>
            <span className="hero-meta">Snapshot: {formatTimestamp(dashboard.summary.data_timestamp)}</span>
          </div>
        </div>

        <div className="carousel-card">
          <div className="carousel-header">
            <span>Top highlights</span>
            <span>{highlightItems.length} tracked</span>
          </div>

          <AnimatePresence mode="wait">
            {activeHighlight ? (
              <motion.article
                key={activeHighlight.id}
                className="highlight-slide"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <p className="eyebrow">Carousel focus</p>
                <h2>{activeHighlight.name}</h2>
                <p className="highlight-location">{activeHighlight.city}, {activeHighlight.country}</p>
                <div className="highlight-metric">{formatCompactNumber(activeHighlight.users_count)}</div>
                <p className="highlight-subtext">students currently represented in the latest cache snapshot</p>
                <div className="delta-pill">
                  Delta since previous snapshot: {activeHighlight.users_delta_since_prev >= 0 ? '+' : ''}
                  {activeHighlight.users_delta_since_prev}
                </div>
              </motion.article>
            ) : null}
          </AnimatePresence>

          <div className="carousel-dots" aria-label="highlight slides">
            {highlightItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === carouselIndex ? 'dot active' : 'dot'}
                onClick={() => setCarouselIndex(index)}
                aria-label={`Show ${item.name}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="stat-grid">
        {overviewStats.map((stat, index) => (
          <motion.article
            key={stat.label}
            className="stat-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
          >
            <p className="stat-label">{stat.label}</p>
            <h3>{stat.value}</h3>
            <p className="stat-detail">{stat.detail}</p>
          </motion.article>
        ))}
      </section>

      <section className="story-grid">
        <article className="story-card emphasis-card">
          <p className="eyebrow">Primary campus</p>
          <h2>{dashboard.primaryCampus.campus.name}</h2>
          <p className="story-copy">
            {dashboard.primaryCampus.campus.city}, {dashboard.primaryCampus.campus.country} is pinned as the first campus profile and will stay stable even when you curate narrower student-specific metrics later.
          </p>
          <div className="pill-row">
            <span className="info-pill">Campus ID {dashboard.primaryCampus.campus.id}</span>
            <span className="info-pill">{formatFullNumber(dashboard.primaryCampus.campus.users_count)} users</span>
            <span className="info-pill">Source {dashboard.primaryCampus.campus.source_status}</span>
          </div>
        </article>

        <article className="story-card">
          <p className="eyebrow">Why this shape works now</p>
          <h2>Frontend before final KPI curation</h2>
          <p className="story-copy">
            The shell is already structured around your future dashboard plan: a top hero carousel, a middle strip of static pills, and two evolving graph spaces below. You can swap the datasets later without changing the layout system.
          </p>
          <div className="pill-row compact-pills">
            <span className="info-pill">React + Vite</span>
            <span className="info-pill">Framer Motion</span>
            <span className="info-pill">Recharts</span>
            <span className="info-pill">Polling every 60s</span>
          </div>
        </article>
      </section>

      <section className="chart-grid">
        {[leftChart, rightChart].map((view, index) => (
          <motion.article
            key={`${view.id}-${index}`}
            className="chart-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.45 }}
          >
            <div className="chart-copy">
              <p className="eyebrow">{view.eyebrow}</p>
              <h2>{view.title}</h2>
              <p className="story-copy">{view.description}</p>
            </div>
            <div className="chart-stage">{view.chart}</div>
          </motion.article>
        ))}
      </section>
    </main>
  )
}

export default App
