import type {
  AchievementsEarnedWeeklyResponse,
  AnalyticsPillsResponse,
  AttendanceWeeklyResponse,
  CoalitionStandingsResponse,
  CoalitionTopScorersResponse,
  LogtimeTopResponse,
  ProjectActivityWeeklyResponse,
  ProjectsPassedRecentResponse,
} from './App'

const NOW = new Date()

function hoursAgoIso(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString()
}

const LOGTIME_USERS = [
  { login: 'akowalsk', first: 'Aleksandra', last: 'Kowalska', hours: 42.6 },
  { login: 'mwisniew', first: 'Marek', last: 'Wiśniewski', hours: 38.2 },
  { login: 'znowak', first: 'Zofia', last: 'Nowak', hours: 35.9 },
  { login: 'jzielins', first: 'Jakub', last: 'Zieliński', hours: 31.4 },
  { login: 'jszymans', first: 'Julia', last: 'Szymańska', hours: 28.7 },
  { login: 'kwojcik', first: 'Kacper', last: 'Wójcik', hours: 24.1 },
]

export const mockLogtimeTop: LogtimeTopResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  logtime_rankings: {
    campus_id: 67,
    week_start_date: hoursAgoIso(7 * 24).slice(0, 10),
    total: LOGTIME_USERS.length,
    items: LOGTIME_USERS.map((user, index) => ({
      user_id: 1000 + index,
      seconds_logged: Math.round(user.hours * 3600),
      sessions_count: 8 + index,
      week_start_date: hoursAgoIso(7 * 24).slice(0, 10),
      collected_at: hoursAgoIso(1),
      login: user.login,
      first_name: user.first,
      last_name: user.last,
      image_url: null,
      hours_logged: user.hours,
    })),
  },
}

const RECENT_PROJECTS = [
  'libft',
  'get_next_line',
  'push_swap',
  'minitalk',
  'so_long',
  'cub3d',
  'minishell',
  'philosophers',
  'netpractice',
  'inception',
]

export const mockProjectsPassedRecent: ProjectsPassedRecentResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  projects_passed_recent: {
    campus_id: 67,
    window_hours: 168,
    total: RECENT_PROJECTS.length,
    items: RECENT_PROJECTS.map((projectName, index) => ({
      user_id: 2000 + index,
      project_id: 100 + index,
      project_name: projectName,
      projects_user_id: 5000 + index,
      marked_at: hoursAgoIso(index * 6),
      user_login: LOGTIME_USERS[index % LOGTIME_USERS.length].login,
      user_image_url: null,
      user_profile_url: `https://api.intra.42.fr/v2/users/${LOGTIME_USERS[index % LOGTIME_USERS.length].login}`,
      collected_at: hoursAgoIso(index * 6),
    })),
  },
}

// Real coalition names/colors/scores as seen on the live backend — kept the
// same here so mock mode looks like the real thing.
const COALITIONS = [
  { id: 459, name: 'Lunaria', slug: 'lunaria', color: '#52BDFF', score: 43300 },
  { id: 458, name: 'Orionis', slug: 'orionis', color: '#BE2AD1', score: 35860 },
  { id: 460, name: 'Uniterrax', slug: 'uniterrax', color: '#FFCD5A', score: 34130 },
]

export const mockCoalitionStandings: CoalitionStandingsResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  standings: {
    campus_id: 67,
    total: COALITIONS.length,
    items: COALITIONS.map((coalition) => ({
      coalition_id: coalition.id,
      campus_id: 67,
      cursus_id: 21,
      coalition_name: coalition.name,
      slug: coalition.slug,
      image_url: null,
      cover_url: null,
      color: coalition.color,
      score: coalition.score,
      score_collected_at: hoursAgoIso(1),
      last_seen_at: hoursAgoIso(0),
    })),
  },
}

// 10 scorers per coalition, so mock mode exercises the same "full top 10"
// dataset shape the live backend returns (limit_per_coalition=10).
const TOP_SCORER_POOL = [
  { login: 'akowalsk', first: 'Aleksandra', last: 'Kowalska' },
  { login: 'mwisniew', first: 'Marek', last: 'Wiśniewski' },
  { login: 'znowak', first: 'Zofia', last: 'Nowak' },
  { login: 'jzielins', first: 'Jakub', last: 'Zieliński' },
  { login: 'jszymans', first: 'Julia', last: 'Szymańska' },
  { login: 'kwojcik', first: 'Kacper', last: 'Wójcik' },
  { login: 'mkowalcz', first: 'Maja', last: 'Kowalczyk' },
  { login: 'fkaminsk', first: 'Filip', last: 'Kamiński' },
  { login: 'nlewando', first: 'Natalia', last: 'Lewandowska' },
  { login: 'adabrows', first: 'Antoni', last: 'Dąbrowski' },
]

export const mockCoalitionTopScorers: CoalitionTopScorersResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  top_scorers: {
    campus_id: 67,
    total: COALITIONS.length * TOP_SCORER_POOL.length,
    items: COALITIONS.flatMap((coalition, coalitionIndex) =>
      TOP_SCORER_POOL.map((user, rankIndex) => ({
        coalition_id: coalition.id,
        user_id: 3000 + coalitionIndex * 100 + rankIndex,
        score: 4200 - coalitionIndex * 150 - rankIndex * 320,
        rank: rankIndex + 1,
        collected_at: hoursAgoIso(1),
        coalition_name: coalition.name,
        slug: coalition.slug,
        color: coalition.color,
        login: `${user.login}${coalitionIndex}`,
        first_name: user.first,
        last_name: user.last,
      })),
    ),
  },
}

export const mockAttendanceWeekly: AttendanceWeeklyResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  attendance: {
    campus_id: 67,
    week_start_date: hoursAgoIso(7 * 24).slice(0, 10),
    unique_students_count: 316,
    collected_at: hoursAgoIso(1),
  },
}

export const mockProjectActivityWeekly: ProjectActivityWeeklyResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  project_activity: {
    campus_id: 67,
    week_start_date: hoursAgoIso(7 * 24).slice(0, 10),
    active_or_started_projects_count: 182,
    created_events_count: 31,
    updated_events_count: 46,
    collected_at: hoursAgoIso(1),
  },
}

export const mockAchievementsEarnedWeekly: AchievementsEarnedWeeklyResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  weekly_achievements_earned: {
    metric_name: 'weekly_achievements_earned',
    metric_value: 83,
    collected_at: hoursAgoIso(1),
    source_status: 'live_api',
    payload: {
      week_start_date: hoursAgoIso(7 * 24).slice(0, 10),
      window_end_date: hoursAgoIso(0).slice(0, 10),
    },
  },
}

export const mockAnalyticsPills: AnalyticsPillsResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  analytics: {
    campus_id: 67,
    users: {
      total: 1550,
      active: 353,
      active_ratio: 0.2277,
    },
    achievements: {
      earned_this_week: 83,
    },
    coalition_scores: {
      avg_user_score: 1200.5,
      top_user_score: 4200,
      ranked_users: 515,
    },
  },
}

export const mockDashboardData = {
  logtimeTop: mockLogtimeTop,
  projectsPassedRecent: mockProjectsPassedRecent,
  coalitionStandings: mockCoalitionStandings,
  coalitionTopScorers: mockCoalitionTopScorers,
  attendanceWeekly: mockAttendanceWeekly,
  projectActivityWeekly: mockProjectActivityWeekly,
  achievementsEarnedWeekly: mockAchievementsEarnedWeekly,
  analyticsPills: mockAnalyticsPills,
}
