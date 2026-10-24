import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { MotionConfig } from 'framer-motion'
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
import { Footer } from './Global/Footer/Footer'
import { PlaybackContext } from './Global/playback'
import { buildFixture } from './demo/fixtures'
import { useDemoTour } from './demo/useDemoTour'

const DEFAULT_CAMPUS_ID = Number(import.meta.env.VITE_PRIMARY_CAMPUS_ID || 67)
const POLL_INTERVAL_MS = 60_000
// In dev the Vite proxy forwards /api/* to the backend, so base is empty.
// A static build that should talk to a real backend sets VITE_API_BASE_URL.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

// Demo mode serves bundled synthetic fixtures and makes zero network calls.
// It is on when VITE_DEMO=true (or the legacy VITE_USE_MOCK_DATA=true), and
// it is the default for production builds that have no backend configured,
// which is what the GitHub Pages build is. VITE_DEMO=false turns it off.
const DEMO_MODE =
  import.meta.env.VITE_DEMO === 'true' ||
  import.meta.env.VITE_USE_MOCK_DATA === 'true' ||
  (import.meta.env.PROD && import.meta.env.VITE_DEMO !== 'false' && !API_BASE)

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
  first_name: string | null
  last_name: string | null
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

export type DashboardData = {
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
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    throw new Error(`Request failed for ${path} with status ${response.status}`)
  }
  return (await response.json()) as T
}

async function resolvePrimaryCampusId(): Promise<number> {
  try {
    const { primary_campus_id } = await readJson<{ primary_campus_id: number }>('/api/v1/config')
    return primary_campus_id
  } catch {
    return DEFAULT_CAMPUS_ID
  }
}

function App() {
  const [liveDashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(!DEMO_MODE)
  const [error, setError] = useState<string | null>(null)

  const isMobile = useIsMobile(760)
  const tour = useDemoTour(DEMO_MODE)
  const [manualPause, setManualPause] = useState(false)
  // The tour has its own pause state; outside demo mode only the manual one.
  const paused = DEMO_MODE ? tour.paused : manualPause
  const setPaused = DEMO_MODE ? tour.setPaused : setManualPause
  const dashboard = useMemo(
    () => (DEMO_MODE ? buildFixture(tour.step.frame) : liveDashboard),
    [liveDashboard, tour.step.frame],
  )

  const fetchDashboard = useEffectEvent(async () => {
    const campusId = await resolvePrimaryCampusId()
    const [
      logtimeTop,
      projectsPassedRecent,
      coalitionStandings,
      coalitionTopScorers,
      attendanceWeekly,
      projectActivityWeekly,
      achievementsEarnedWeekly,
      analyticsPills,
    ] = await Promise.all([
          readJson<LogtimeTopResponse>(`/api/v1/campus/${campusId}/users/logtime-top?limit=10`),
          readJson<ProjectsPassedRecentResponse>(
            `/api/v1/campus/${campusId}/projects/passed-recent?hours=168&limit=50`,
          ),
          readJson<CoalitionStandingsResponse>(`/api/v1/campus/${campusId}/coalitions/standings`),
          readJson<CoalitionTopScorersResponse>(
            `/api/v1/campus/${campusId}/coalitions/top-scorers?limit_per_coalition=10`,
          ),
          readJson<AttendanceWeeklyResponse>(`/api/v1/campus/${campusId}/attendance/weekly`),
          readJson<ProjectActivityWeeklyResponse>(`/api/v1/campus/${campusId}/projects/activity-weekly`),
          readJson<AchievementsEarnedWeeklyResponse>(`/api/v1/campus/${campusId}/achievements/earned-weekly`),
          readJson<AnalyticsPillsResponse>(`/api/v1/campus/${campusId}/analytics/pills`),
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
    // Demo mode never touches the network.
    if (DEMO_MODE) {
      return
    }
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
  // Restart the story cycle when the scripted data advances or the tour replays.
  const storyResetKey = DEMO_MODE ? `${tour.runId}:${tour.step.frame}` : ''

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
        <section className="loading-card glass-panel" role="status">
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
          <a className="inline-link" href={`${API_BASE || 'http://127.0.0.1:8000'}/health`} target="_blank" rel="noreferrer">
            Check backend health endpoint
          </a>
        </section>
      </main>
    )
  }

  const controlling = DEMO_MODE && tour.controlling
  const forcedGraph = controlling ? tour.step.graphSlide : undefined
  const forcedStats = controlling ? tour.step.statsSlide : undefined

  return (
    <MotionConfig reducedMotion="user">
      <PlaybackContext.Provider value={{ paused }}>
        <main className={stageClassName}>
          <Background />
          <div className={shellClassName} data-spotlight={controlling ? tour.step.spotlight : undefined}>
            <StoriesPanel events={storyEvents} resetKey={storyResetKey} />
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
              forcedSlide={forcedGraph}
            />
            <StatsPanel
              heroes={heroes}
              coalitionTopScorers={dashboard.coalitionTopScorers.top_scorers.items}
              analytics={dashboard.analyticsPills.analytics}
              forcedSlide={forcedStats}
            />
            <Footer
              tour={DEMO_MODE ? tour : null}
              paused={paused}
              onTogglePaused={() => setPaused(!paused)}
            />
          </div>
        </main>
      </PlaybackContext.Provider>
    </MotionConfig>
  )
}

export default App
