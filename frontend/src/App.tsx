import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react'
import './Global/liquid_glass.css'
import './Global/titles.css'
import './Global/layout.css'
import { StoriesPanel } from './Stories/stories_main'
import { GraphsPanel } from './Graphs/graphs_main'
import { StatsPanel } from './Stats/stats_main'
import { useIsMobile } from './Global/hooks/useIsMobile'
import { mockDashboardData } from './dashboardData.mock'

const PRIMARY_CAMPUS_ID = Number(import.meta.env.VITE_PRIMARY_CAMPUS_ID ?? 67)
const POLL_INTERVAL_MS = 60_000
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

export type SourceMode = 'fresh_cache' | 'refreshed' | 'stale_fallback'

export type SummaryResponse = {
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

export type Highlight = {
  id: number
  name: string
  city: string
  country: string
  users_count: number
  users_delta_since_prev: number
}

export type HighlightsResponse = {
  source_mode: SourceMode
  cache_age_seconds: number | null
  data_timestamp: string | null
  highlights: {
    top_count: number
    items: Highlight[]
  }
}

export type CampusResponse = {
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

export type HistoryPoint = {
  users_count: number
  collected_at: string
  source_status: string
}

export type HistoryResponse = {
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

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Request failed for ${path} with status ${response.status}`)
  }
  return (await response.json()) as T
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isMobile = useIsMobile(760)

  const fetchDashboard = useEffectEvent(async () => {
    const [summary, highlights, primaryCampus, history] = USE_MOCK_DATA
      ? await new Promise<[SummaryResponse, HighlightsResponse, CampusResponse, HistoryResponse]>((resolve) => {
          window.setTimeout(
            () =>
              resolve([
                mockDashboardData.summary,
                mockDashboardData.highlights,
                mockDashboardData.primaryCampus,
                mockDashboardData.history,
              ]),
            300,
          )
        })
      : await Promise.all([
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

  const historySeries = useMemo(() => {
    return (dashboard?.history.history ?? []).map((point) => ({
      label: formatShortTime(point.collected_at),
      users: point.users_count,
    }))
  }, [dashboard?.history.history])

  const shellClassName = `dashboard-shell${isMobile ? ' is-mobile' : ''}`
  const stageClassName = `stage${isMobile ? ' is-mobile' : ''}`

  if (loading) {
    return (
      <main className="stage loading-state">
        <section className="loading-card glass-panel">
          <p className="eyebrow">Booting dashboard</p>
          <h1>Preparing the first 42Warsaw community view.</h1>
          <p>Fetching campus history from the FastAPI cache.</p>
        </section>
      </main>
    )
  }

  if (error || !dashboard) {
    return (
      <main className="stage loading-state">
        <section className="loading-card error-card glass-panel">
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
    <main className={stageClassName}>
      <div className={shellClassName}>
        <StoriesPanel />
        <GraphsPanel historySeries={historySeries} />
        <StatsPanel />
      </div>
    </main>
  )
}

export default App
