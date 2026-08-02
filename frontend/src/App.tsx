import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react'
import './Global/liquid_glass.css'
import './Global/titles.css'
import './Global/layout.css'
import { Background } from './Global/Background/Background'
import { StoriesPanel } from './Stories/stories_main'
import { buildStoryEvents } from './Stories/storyEvents'
import { GraphsPanel } from './Graphs/graphs_main'
import { StatsPanel } from './Stats/stats_main'
import { buildHeroes } from './Stats/heroes'
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

export type LogtimeUser = {
  user_id: number
  seconds_logged: number
  sessions_count: number
  week_start_date: string
  collected_at: string
  login: string
  first_name: string | null
  last_name: string | null
  image_url: string | null
  hours_logged: number
}

export type LogtimeTopResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  logtime_rankings: {
    campus_id: number
    week_start_date: string | null
    total: number
    items: LogtimeUser[]
  }
}

export type ProjectPass = {
  user_id: number
  project_id: number
  project_name: string
  projects_user_id: number
  marked_at: string
  user_login: string
  user_image_url: string | null
  user_profile_url: string
  collected_at: string
}

export type ProjectsPassedRecentResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  projects_passed_recent: {
    campus_id: number
    window_hours: number
    total: number
    items: ProjectPass[]
  }
}

export type CoalitionStanding = {
  coalition_id: number
  campus_id: number
  cursus_id: number
  coalition_name: string
  slug: string
  image_url: string | null
  cover_url: string | null
  color: string
  score: number | null
  score_collected_at: string | null
  last_seen_at: string
}

export type CoalitionStandingsResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  standings: {
    campus_id: number
    total: number
    items: CoalitionStanding[]
  }
}

export type CoalitionTopScorer = {
  coalition_id: number
  user_id: number
  score: number
  rank: number | null
  collected_at: string
  coalition_name: string
  slug: string
  color: string
  login: string
  first_name: string | null
  last_name: string | null
}

export type CoalitionTopScorersResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  top_scorers: {
    campus_id: number
    total: number
    items: CoalitionTopScorer[]
  }
}

type DashboardData = {
  summary: SummaryResponse
  highlights: HighlightsResponse
  primaryCampus: CampusResponse
  history: HistoryResponse
  logtimeTop: LogtimeTopResponse
  projectsPassedRecent: ProjectsPassedRecentResponse
  coalitionStandings: CoalitionStandingsResponse
  coalitionTopScorers: CoalitionTopScorersResponse
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
    const [summary, highlights, primaryCampus, history, logtimeTop, projectsPassedRecent, coalitionStandings, coalitionTopScorers] =
      USE_MOCK_DATA
        ? await new Promise<
            [
              SummaryResponse,
              HighlightsResponse,
              CampusResponse,
              HistoryResponse,
              LogtimeTopResponse,
              ProjectsPassedRecentResponse,
              CoalitionStandingsResponse,
              CoalitionTopScorersResponse,
            ]
          >((resolve) => {
            window.setTimeout(
              () =>
                resolve([
                  mockDashboardData.summary,
                  mockDashboardData.highlights,
                  mockDashboardData.primaryCampus,
                  mockDashboardData.history,
                  mockDashboardData.logtimeTop,
                  mockDashboardData.projectsPassedRecent,
                  mockDashboardData.coalitionStandings,
                  mockDashboardData.coalitionTopScorers,
                ]),
              300,
            )
          })
        : await Promise.all([
            readJson<SummaryResponse>('/api/v1/summary'),
            readJson<HighlightsResponse>('/api/v1/highlights?top_n=6'),
            readJson<CampusResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}`),
            readJson<HistoryResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/history?points=24`),
            readJson<LogtimeTopResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/users/logtime-top?limit=10`),
            readJson<ProjectsPassedRecentResponse>(
              `/api/v1/campus/${PRIMARY_CAMPUS_ID}/projects/passed-recent?hours=168&limit=50`,
            ),
            readJson<CoalitionStandingsResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/coalitions/standings`),
            readJson<CoalitionTopScorersResponse>(
              `/api/v1/campus/${PRIMARY_CAMPUS_ID}/coalitions/top-scorers?limit_per_coalition=1`,
            ),
          ])

    startTransition(() => {
      setDashboard({
        summary,
        highlights,
        primaryCampus,
        history,
        logtimeTop,
        projectsPassedRecent,
        coalitionStandings,
        coalitionTopScorers,
      })
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

  const storyEvents = useMemo(() => {
    if (!dashboard) {
      return []
    }
    return buildStoryEvents(dashboard.logtimeTop, dashboard.projectsPassedRecent)
  }, [dashboard])

  const heroes = useMemo(() => {
    if (!dashboard) {
      return []
    }
    return buildHeroes(dashboard.logtimeTop, dashboard.coalitionTopScorers, dashboard.projectsPassedRecent)
  }, [dashboard])

  const shellClassName = `dashboard-shell${isMobile ? ' is-mobile' : ''}`
  const stageClassName = `stage${isMobile ? ' is-mobile' : ''}`

  if (loading) {
    return (
      <main className="stage loading-state">
        <Background />
        <section className="loading-card glass-panel">
          <p className="eyebrow eyebrow-on-color">Booting dashboard</p>
          <h1>Preparing the first 42Warsaw community view.</h1>
          <p>Fetching campus history from the FastAPI cache.</p>
        </section>
      </main>
    )
  }

  if (error || !dashboard) {
    return (
      <main className="stage loading-state">
        <Background />
        <section className="loading-card error-card glass-panel">
          <p className="eyebrow eyebrow-on-color">Frontend can reach Vite, but data is missing</p>
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
      <Background />
      <div className={shellClassName}>
        <StoriesPanel events={storyEvents} />
        <GraphsPanel
          historySeries={historySeries}
          logtimeLeaders={dashboard.logtimeTop.logtime_rankings.items}
          coalitionStandings={dashboard.coalitionStandings.standings.items}
        />
        <StatsPanel heroes={heroes} />
      </div>
    </main>
  )
}

export default App
