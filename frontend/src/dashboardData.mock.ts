import type {
  CampusResponse,
  HighlightsResponse,
  HistoryPoint,
  HistoryResponse,
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

export const mockDashboardData = {
  summary: mockSummary,
  highlights: mockHighlights,
  primaryCampus: mockPrimaryCampus,
  history: mockHistory,
}
