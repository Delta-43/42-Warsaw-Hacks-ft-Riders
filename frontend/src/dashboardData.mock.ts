import type {
  CampusResponse,
  CoalitionStandingsResponse,
  CoalitionTopScorersResponse,
  HighlightsResponse,
  HistoryPoint,
  HistoryResponse,
  LogtimeTopResponse,
  ProjectsPassedRecentResponse,
  SummaryResponse,
} from './App'

const NOW = new Date()

function hoursAgoIso(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString()
}

function buildHistory(basePoint: number, count: number): HistoryPoint[] {
  const points: HistoryPoint[] = []
  let running = basePoint

  for (let i = count - 1; i >= 0; i -= 1) {
    running += Math.round(Math.sin(i / 3) * 4 + (Math.random() - 0.3) * 3)
    points.push({
      users_count: Math.max(running, 0),
      collected_at: hoursAgoIso(i),
      source_status: 'live_api',
    })
  }

  return points
}

const warsawHistory = buildHistory(540, 24)
const warsawUsersCount = warsawHistory[warsawHistory.length - 1].users_count

export const mockSummary: SummaryResponse = {
  source_mode: 'fresh_cache',
  cache_age_seconds: 128,
  data_timestamp: hoursAgoIso(0),
  summary: {
    total_campuses: 52,
    total_users: 31840,
    top_campus: {
      id: 1,
      name: '42Paris',
      users_count: 4210,
    },
  },
}

export const mockHighlights: HighlightsResponse = {
  source_mode: 'fresh_cache',
  cache_age_seconds: 128,
  data_timestamp: hoursAgoIso(0),
  highlights: {
    top_count: 6,
    items: [
      { id: 1, name: '42Paris', city: 'Paris', country: 'France', users_count: 4210, users_delta_since_prev: 12 },
      { id: 21, name: '42Berlin', city: 'Berlin', country: 'Germany', users_count: 2870, users_delta_since_prev: -4 },
      { id: 67, name: '42Warsaw', city: 'Warsaw', country: 'Poland', users_count: warsawUsersCount, users_delta_since_prev: 7 },
      { id: 9, name: '42London', city: 'London', country: 'United Kingdom', users_count: 2510, users_delta_since_prev: 3 },
      { id: 14, name: '42Lisboa', city: 'Lisbon', country: 'Portugal', users_count: 1980, users_delta_since_prev: 0 },
      { id: 33, name: '42Amsterdam', city: 'Amsterdam', country: 'Netherlands', users_count: 1745, users_delta_since_prev: -2 },
    ],
  },
}

export const mockPrimaryCampus: CampusResponse = {
  source_mode: 'fresh_cache',
  cache_age_seconds: 128,
  data_timestamp: hoursAgoIso(0),
  campus: {
    id: 67,
    name: '42Warsaw',
    city: 'Warsaw',
    country: 'Poland',
    users_count: warsawUsersCount,
    collected_at: hoursAgoIso(0),
    source_status: 'live_api',
  },
}

export const mockHistory: HistoryResponse = {
  source_mode: 'fresh_cache',
  cache_age_seconds: 128,
  data_timestamp: hoursAgoIso(0),
  campus: {
    id: 67,
    name: '42Warsaw',
  },
  points: warsawHistory.length,
  history: warsawHistory,
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

export const mockCoalitionTopScorers: CoalitionTopScorersResponse = {
  source_mode: 'fresh_cache',
  data_timestamp: hoursAgoIso(0),
  top_scorers: {
    campus_id: 67,
    total: COALITIONS.length,
    items: COALITIONS.map((coalition, index) => ({
      coalition_id: coalition.id,
      user_id: 3000 + index,
      score: 4200 - index * 350,
      rank: 1,
      collected_at: hoursAgoIso(1),
      coalition_name: coalition.name,
      slug: coalition.slug,
      color: coalition.color,
      login: LOGTIME_USERS[index].login,
      first_name: LOGTIME_USERS[index].first,
      last_name: LOGTIME_USERS[index].last,
    })),
  },
}

export const mockDashboardData = {
  summary: mockSummary,
  highlights: mockHighlights,
  primaryCampus: mockPrimaryCampus,
  history: mockHistory,
  logtimeTop: mockLogtimeTop,
  projectsPassedRecent: mockProjectsPassedRecent,
  coalitionStandings: mockCoalitionStandings,
  coalitionTopScorers: mockCoalitionTopScorers,
}
