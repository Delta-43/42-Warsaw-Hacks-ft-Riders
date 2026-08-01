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

type SourceMode = 'fresh_cache' | 'refreshed' | 'stale_fallback' | 'db_cache'

type CampusResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  campus: {
    id: number
    name: string
    city: string
    country: string
    users_count: number
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
  data_timestamp: string | null
  campus: {
    id: number
    name: string
  }
  points: number
  history: HistoryPoint[]
}

type AnalyticsPillsResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  analytics: {
    campus_id: number
    users: {
      total: number
      active: number
      active_ratio: number
    }
    achievements: {
      catalog_total: number
      total_unlocks: number
      avg_users_per_achievement: number
      avg_achievements_per_user: number
      users_with_achievements: number
      total_achievements_earned: number
    }
    coalition_scores: {
      avg_user_score: number
      top_user_score: number
      ranked_users: number
    }
  }
}

type CoalitionRankItem = {
  coalition_id: number
  coalition_name: string
  slug: string
  color: string
  user_id: number
  login: string | null
  first_name: string | null
  last_name: string | null
  score: number
  rank: number | null
  collected_at: string
}

type CoalitionRankingsResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  rankings: {
    campus_id: number
    total: number
    items: CoalitionRankItem[]
  }
}

type AchievementCoverageItem = {
  achievement_id: number
  name: string
  kind: string
  tier: string
  visible: number
  users_count: number
  collected_at: string
}

type AchievementCoverageResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  achievements: {
    campus_id: number
    total: number
    items: AchievementCoverageItem[]
  }
}

type DashboardData = {
  analytics: AnalyticsPillsResponse
  rankings: CoalitionRankingsResponse
  coverage: AchievementCoverageResponse
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
  if (mode === 'db_cache') {
    return 'DB cache'
  }
  return 'Cache live'
}

function trimLabel(value: string, maxLength = 24) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}…`
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [chartRotation, setChartRotation] = useState(0)

  const fetchDashboard = useEffectEvent(async () => {
    const [analytics, rankings, coverage, primaryCampus, history] = await Promise.all([
      readJson<AnalyticsPillsResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/analytics/pills`),
      readJson<CoalitionRankingsResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/coalitions/rankings?limit_per_coalition=5`),
      readJson<AchievementCoverageResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/achievements/coverage?limit=16`),
      readJson<CampusResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}`),
      readJson<HistoryResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/history?points=24`),
    ])

    startTransition(() => {
      setDashboard({ analytics, rankings, coverage, primaryCampus, history })
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

  const championRows = useMemo(() => {
    if (!dashboard) {
      return []
    }

    const byCoalition = new Map<number, CoalitionRankItem>()
    for (const item of dashboard.rankings.rankings.items) {
      const existing = byCoalition.get(item.coalition_id)
      if (!existing || (item.rank ?? 9_999) < (existing.rank ?? 9_999) || item.score > existing.score) {
        byCoalition.set(item.coalition_id, item)
      }
    }

    return Array.from(byCoalition.values()).sort((a, b) => a.coalition_name.localeCompare(b.coalition_name))
  }, [dashboard])

  useEffect(() => {
    if (!championRows.length) {
      return
    }

    const intervalId = window.setInterval(() => {
      setCarouselIndex((currentIndex) => {
        const total = championRows.length
        return (currentIndex + 1) % total
      })
    }, 4500)

    return () => window.clearInterval(intervalId)
  }, [championRows])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setChartRotation((currentIndex) => currentIndex + 1)
    }, 5200)

    return () => window.clearInterval(intervalId)
  }, [])

  const activeChampion = championRows[carouselIndex] ?? null

  const historySeries = useMemo(() => {
    return (dashboard?.history.history ?? []).map((point) => ({
      label: formatShortTime(point.collected_at),
      users: point.users_count,
      snapshot: point.source_status,
    }))
  }, [dashboard?.history.history])

  const coalitionChampionsSeries = useMemo(() => {
    return championRows.map((item) => ({
      coalition: item.coalition_name,
      user: item.login ?? `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim(),
      score: item.score,
      rank: item.rank ?? 0,
      fill: item.color || '#4ecdc4',
    }))
  }, [championRows])

  const achievementsSeries = useMemo(() => {
    return (dashboard?.coverage.achievements.items ?? []).slice(0, 10).map((item) => ({
      name: trimLabel(item.name),
      users: item.users_count,
      kind: item.kind,
    }))
  }, [dashboard?.coverage.achievements.items])

  const achievementSpreadSeries = useMemo(() => {
    if (!dashboard) {
      return []
    }

    const totalUsers = dashboard.analytics.analytics.users.total
    const usersWithAchievements = dashboard.analytics.analytics.achievements.users_with_achievements

    return [
      { label: 'With achievements', users: usersWithAchievements },
      { label: 'Without achievements', users: Math.max(totalUsers - usersWithAchievements, 0) },
    ]
  }, [dashboard])

  const overviewStats = useMemo(() => {
    if (!dashboard) {
      return []
    }

    const users = dashboard.analytics.analytics.users
    const achievements = dashboard.analytics.analytics.achievements
    const coalition = dashboard.analytics.analytics.coalition_scores

    return [
      {
        label: 'Campus users',
        value: formatFullNumber(users.total),
        detail: `${formatFullNumber(users.active)} active (${(users.active_ratio * 100).toFixed(1)}%)`,
      },
      {
        label: 'Achievement unlocks',
        value: formatFullNumber(achievements.total_achievements_earned),
        detail: `${formatFullNumber(achievements.catalog_total)} tracked achievements`,
      },
      {
        label: 'Avg achievements / user',
        value: achievements.avg_achievements_per_user.toFixed(2),
        detail: `${formatFullNumber(achievements.users_with_achievements)} users unlocked at least one`,
      },
      {
        label: 'Avg coalition score',
        value: coalition.avg_user_score.toFixed(1),
        detail: `Top user score ${formatFullNumber(coalition.top_user_score)}`,
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
        title: 'Campus users trend by snapshot',
        description: 'The trend line still reads directly from cached history snapshots so every refresh extends this automatically.',
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
        id: 'coalition-champions',
        eyebrow: 'Coalitions',
        title: 'Top ranked user per coalition',
        description: 'This chart is sourced from /coalitions/{id}/coalitions_users snapshots and lets you surface live competitive leaders.',
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={coalitionChampionsSeries} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="coalition" tickLine={false} axisLine={false} width={92} />
              <Tooltip formatter={(value) => formatFullNumber(Number(value))} />
              <Bar dataKey="score" fill="#4ecdc4" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ),
      },
      {
        id: 'achievement-coverage',
        eyebrow: 'Achievements',
        title: 'Most earned achievements in campus',
        description: 'Coverage is derived from /achievements/{achievement_id}/achievements_users filtered against your campus users.',
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={achievementsSeries}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-14} textAnchor="end" height={76} />
              <YAxis tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(value) => formatFullNumber(Number(value))} />
              <Bar dataKey="users" fill="#ffd166" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ),
      },
      {
        id: 'achievement-spread',
        eyebrow: 'Population',
        title: 'Achievement penetration in campus',
        description: 'Quick split showing how many users have at least one achievement versus users with none.',
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={achievementSpreadSeries}>
              <defs>
                <linearGradient id="achievementSpread" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#4ecdc4" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#4ecdc4" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(value) => formatFullNumber(Number(value))} />
              <Area type="monotone" dataKey="users" stroke="#4ecdc4" fill="url(#achievementSpread)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        ),
      },
    ]
  }, [dashboard, historySeries, coalitionChampionsSeries, achievementsSeries, achievementSpreadSeries])

  const leftChart = chartViews[chartRotation % Math.max(chartViews.length, 1)]
  const rightChart = chartViews[(chartRotation + 2) % Math.max(chartViews.length, 1)]

  if (loading) {
    return (
      <main className="dashboard-shell loading-state">
        <section className="loading-card">
          <p className="eyebrow">Booting dashboard</p>
          <h1>Preparing analytics for coalition and achievement insights.</h1>
          <p>Fetching pills, rankings, achievement coverage, and campus trend snapshots from the FastAPI cache.</p>
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
          <a className="inline-link" href="http://127.0.0.1:8000/api/v1/campus/67/analytics/pills" target="_blank" rel="noreferrer">
            Check backend analytics endpoint
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">42Warsaw analytics cockpit</p>
          <h1>Live ranking, active users, achievement spread.</h1>
          <p className="hero-text">
            The UI now consumes dedicated analytics endpoints so your pills and charts map directly to cached coalition scores and filtered achievement data.
          </p>
          <div className="hero-meta-row">
            <span className={`status-pill status-${dashboard.analytics.source_mode}`}>
              {sourceModeLabel(dashboard.analytics.source_mode)}
            </span>
            <span className="hero-meta">Snapshot: {formatTimestamp(dashboard.analytics.data_timestamp)}</span>
          </div>
        </div>

        <div className="carousel-card">
          <div className="carousel-header">
            <span>Coalition champions</span>
            <span>{championRows.length} coalitions</span>
          </div>

          <AnimatePresence mode="wait">
            {activeChampion ? (
              <motion.article
                key={`${activeChampion.coalition_id}-${activeChampion.user_id}`}
                className="highlight-slide"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <p className="eyebrow">{activeChampion.coalition_name}</p>
                <h2>{activeChampion.login ?? `User ${activeChampion.user_id}`}</h2>
                <p className="highlight-location">
                  {(activeChampion.first_name ?? '').trim()} {(activeChampion.last_name ?? '').trim()}
                </p>
                <div className="highlight-metric">{formatCompactNumber(activeChampion.score)}</div>
                <p className="highlight-subtext">ranked #{activeChampion.rank ?? '-'} with latest coalition score snapshot</p>
                <div className="delta-pill">Coalition: {activeChampion.slug}</div>
              </motion.article>
            ) : null}
          </AnimatePresence>

          <div className="carousel-dots" aria-label="champion slides">
            {championRows.map((item, index) => (
              <button
                key={item.coalition_id}
                type="button"
                className={index === carouselIndex ? 'dot active' : 'dot'}
                onClick={() => setCarouselIndex(index)}
                aria-label={`Show ${item.coalition_name}`}
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
          <p className="eyebrow">Campus profile</p>
          <h2>{dashboard.primaryCampus.campus.name}</h2>
          <p className="story-copy">
            {dashboard.primaryCampus.campus.city}, {dashboard.primaryCampus.campus.country} remains your main context and all analytics widgets are filtered to this campus data.
          </p>
          <div className="pill-row">
            <span className="info-pill">Campus ID {dashboard.primaryCampus.campus.id}</span>
            <span className="info-pill">{formatFullNumber(dashboard.primaryCampus.campus.users_count)} users</span>
            <span className="info-pill">Achievement records {formatFullNumber(dashboard.coverage.achievements.total)}</span>
          </div>
        </article>

        <article className="story-card">
          <p className="eyebrow">Data path</p>
          <h2>Backend endpoints now drive every KPI</h2>
          <p className="story-copy">
            Pills consume /analytics/pills, leaderboard consumes /coalitions/rankings, and achievement chart consumes /achievements/coverage. This keeps frontend logic thin and lets backend cache own aggregation.
          </p>
          <div className="pill-row compact-pills">
            <span className="info-pill">Polling every 60s</span>
            <span className="info-pill">FastAPI + SQLite cache</span>
            <span className="info-pill">Framer Motion + Recharts</span>
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
