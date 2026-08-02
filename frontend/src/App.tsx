import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react'
import './Global/liquid_glass.css'
import './Global/titles.css'
import './Global/layout.css'
import { Background } from './Global/Background/Background'
import { Watermark } from './Global/Watermark/Watermark'
import { StoriesPanel } from './Stories/stories_main'
import { buildStoryEvents } from './Stories/storyEvents'
import { MetricsStrip } from './Metrics/metrics_strip'
import { GraphsPanel } from './Graphs/graphs_main'
import { StatsPanel } from './Stats/stats_main'
import { buildHeroes } from './Stats/heroes'
import { useIsMobile } from './Global/hooks/useIsMobile'
import { mockDashboardData } from './dashboardData.mock'

const PRIMARY_CAMPUS_ID = Number(import.meta.env.VITE_PRIMARY_CAMPUS_ID ?? 67)
const POLL_INTERVAL_MS = 60_000
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

export type SourceMode = 'fresh_cache' | 'refreshed' | 'stale_fallback'

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

export type AttendanceWeeklyResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  attendance: {
    campus_id: number
    week_start_date: string
    unique_students_count: number
    collected_at: string
  }
}

export type ProjectActivityWeeklyResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  project_activity: {
    campus_id: number
    week_start_date: string
    active_or_started_projects_count: number
    created_events_count: number
    updated_events_count: number
    collected_at: string
  }
}

export type AchievementsEarnedWeeklyResponse = {
  source_mode: SourceMode
  data_timestamp: string | null
  weekly_achievements_earned: {
    metric_name: string
    metric_value: number
    collected_at: string
    source_status: string
    payload: {
      week_start_date: string
      window_end_date: string
    }
  }
}

export type AnalyticsPillsResponse = {
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
      earned_this_week: number
    }
    coalition_scores: {
      avg_user_score: number
      top_user_score: number
      ranked_users: number
    }
  }
}

type DashboardData = {
  logtimeTop: LogtimeTopResponse
  projectsPassedRecent: ProjectsPassedRecentResponse
  coalitionStandings: CoalitionStandingsResponse
  coalitionTopScorers: CoalitionTopScorersResponse
  attendanceWeekly: AttendanceWeeklyResponse
  projectActivityWeekly: ProjectActivityWeeklyResponse
  achievementsEarnedWeekly: AchievementsEarnedWeeklyResponse
  analyticsPills: AnalyticsPillsResponse
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Request failed for ${path} with status ${response.status}`)
  }
  return (await response.json()) as T
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isMobile = useIsMobile(760)

  const fetchDashboard = useEffectEvent(async () => {
    const [
      logtimeTop,
      projectsPassedRecent,
      coalitionStandings,
      coalitionTopScorers,
      attendanceWeekly,
      projectActivityWeekly,
      achievementsEarnedWeekly,
      analyticsPills,
    ] = USE_MOCK_DATA
      ? await new Promise<
          [
            LogtimeTopResponse,
            ProjectsPassedRecentResponse,
            CoalitionStandingsResponse,
            CoalitionTopScorersResponse,
            AttendanceWeeklyResponse,
            ProjectActivityWeeklyResponse,
            AchievementsEarnedWeeklyResponse,
            AnalyticsPillsResponse,
          ]
        >((resolve) => {
          window.setTimeout(
            () =>
              resolve([
                mockDashboardData.logtimeTop,
                mockDashboardData.projectsPassedRecent,
                mockDashboardData.coalitionStandings,
                mockDashboardData.coalitionTopScorers,
                mockDashboardData.attendanceWeekly,
                mockDashboardData.projectActivityWeekly,
                mockDashboardData.achievementsEarnedWeekly,
                mockDashboardData.analyticsPills,
              ]),
            300,
          )
        })
      : await Promise.all([
          readJson<LogtimeTopResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/users/logtime-top?limit=10`),
          readJson<ProjectsPassedRecentResponse>(
            `/api/v1/campus/${PRIMARY_CAMPUS_ID}/projects/passed-recent?hours=168&limit=50`,
          ),
          readJson<CoalitionStandingsResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/coalitions/standings`),
          readJson<CoalitionTopScorersResponse>(
            `/api/v1/campus/${PRIMARY_CAMPUS_ID}/coalitions/top-scorers?limit_per_coalition=10`,
          ),
          readJson<AttendanceWeeklyResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/attendance/weekly`),
          readJson<ProjectActivityWeeklyResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/projects/activity-weekly`),
          readJson<AchievementsEarnedWeeklyResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/achievements/earned-weekly`),
          readJson<AnalyticsPillsResponse>(`/api/v1/campus/${PRIMARY_CAMPUS_ID}/analytics/pills`),
        ])

    startTransition(() => {
      setDashboard({
        logtimeTop,
        projectsPassedRecent,
        coalitionStandings,
        coalitionTopScorers,
        attendanceWeekly,
        projectActivityWeekly,
        achievementsEarnedWeekly,
        analyticsPills,
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
    return buildHeroes(dashboard.logtimeTop, dashboard.projectsPassedRecent)
  }, [dashboard])

  const shellClassName = `dashboard-shell${isMobile ? ' is-mobile' : ''}`
  const stageClassName = `stage${isMobile ? ' is-mobile' : ''}`

  if (loading) {
    return (
      <main className="stage loading-state">
        <Background />
        <Watermark />
        <section className="loading-card glass-panel">
          <p className="eyebrow eyebrow-on-color">Booting dashboard</p>
          <h1>Preparing the first 42Warsaw community view.</h1>
          <p>Fetching live campus activity from the FastAPI cache.</p>
        </section>
      </main>
    )
  }

  if (error || !dashboard) {
    return (
      <main className="stage loading-state">
        <Background />
        <Watermark />
        <section className="loading-card error-card glass-panel">
          <p className="eyebrow eyebrow-on-color">Frontend can reach Vite, but data is missing</p>
          <h1>Dashboard data request failed.</h1>
          <p>{error ?? 'Unknown error'}</p>
          <a className="inline-link" href="http://127.0.0.1:8000/health" target="_blank" rel="noreferrer">
            Check backend health endpoint
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className={stageClassName}>
      <Background />
      <Watermark />
      <div className={shellClassName}>
        <StoriesPanel events={storyEvents} />
        <MetricsStrip
          analytics={dashboard.analyticsPills.analytics}
          achievementsEarnedWeekly={dashboard.achievementsEarnedWeekly}
          projectActivityWeekly={dashboard.projectActivityWeekly}
          attendanceWeekly={dashboard.attendanceWeekly}
        />
        <GraphsPanel
          logtimeLeaders={dashboard.logtimeTop.logtime_rankings.items}
          coalitionStandings={dashboard.coalitionStandings.standings.items}
          coalitionTopScorers={dashboard.coalitionTopScorers.top_scorers.items}
        />
        <StatsPanel
          heroes={heroes}
          coalitionTopScorers={dashboard.coalitionTopScorers.top_scorers.items}
          analytics={dashboard.analyticsPills.analytics}
        />
      </div>
    </main>
  )
}

export default App
