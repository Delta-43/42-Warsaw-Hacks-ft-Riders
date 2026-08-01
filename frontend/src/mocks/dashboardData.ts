import type {
  CampusResponse,
  HighlightsResponse,
  HistoryPoint,
  HistoryResponse,
  SummaryResponse,
} from '../App'

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

export type Student = {
  id: number
  name: string
  initials: string
  colorFrom: string
  colorTo: string
}

const AVATAR_PALETTE: Array<[string, string]> = [
  ['#6FBBF9', '#3E7FE0'],
  ['#AF38CA', '#7A1FA8'],
  ['#F7CF6E', '#E0A93B'],
  ['#6FE0BB', '#2FA98A'],
  ['#F98F8F', '#D65C5C'],
]

const STUDENT_NAMES = [
  'Aleksandra Kowalska',
  'Marek Wiśniewski',
  'Zofia Nowak',
  'Jakub Zieliński',
  'Julia Szymańska',
  'Kacper Wójcik',
  'Maja Kowalczyk',
  'Filip Kamiński',
  'Natalia Lewandowska',
  'Antoni Dąbrowski',
  'Hanna Michalska',
  'Piotr Wróbel',
  'Lena Król',
  'Szymon Ostrowski',
  'Amelia Piotrowska',
  'Franciszek Grabowski',
]

function initialsFor(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export const mockStudents: Student[] = STUDENT_NAMES.map((name, index) => {
  const [colorFrom, colorTo] = AVATAR_PALETTE[index % AVATAR_PALETTE.length]
  return {
    id: index + 1,
    name,
    initials: initialsFor(name),
    colorFrom,
    colorTo,
  }
})

export type MilestoneSlice = {
  milestone: string
  students: number
}

export const mockMilestones: MilestoneSlice[] = [
  { milestone: 'M0', students: 132 },
  { milestone: 'M1', students: 104 },
  { milestone: 'M2', students: 88 },
  { milestone: 'M3', students: 61 },
  { milestone: 'M4', students: 40 },
  { milestone: 'M5', students: 24 },
  { milestone: 'M6', students: 11 },
  { milestone: 'M7', students: 4 },
]

export type WeekdayHours = {
  day: string
  hours: number
}

export const mockWeekdayHours: WeekdayHours[] = [
  { day: 'Mon', hours: 412 },
  { day: 'Tue', hours: 388 },
  { day: 'Wed', hours: 405 },
  { day: 'Thu', hours: 396 },
  { day: 'Fri', hours: 344 },
  { day: 'Sat', hours: 176 },
  { day: 'Sun', hours: 152 },
]

export type Hero = {
  id: string
  category: string
  name: string
  value: string
  unit: string
  initials: string
  colorFrom: string
  colorTo: string
}

export const mockHeroes: Hero[] = [
  {
    id: 'hours',
    category: 'Most hours logged',
    name: 'Aleksandra Kowalska',
    value: '187',
    unit: 'hours this week',
    initials: 'AK',
    colorFrom: '#6FBBF9',
    colorTo: '#3E7FE0',
  },
  {
    id: 'xp',
    category: 'Most XP earned',
    name: 'Marek Wiśniewski',
    value: '42,300',
    unit: 'XP this week',
    initials: 'MW',
    colorFrom: '#AF38CA',
    colorTo: '#7A1FA8',
  },
  {
    id: 'wallet',
    category: 'Most Altarian Dollars',
    name: 'Zofia Nowak',
    value: '128',
    unit: 'Ⱥ$ earned',
    initials: 'ZN',
    colorFrom: '#F7CF6E',
    colorTo: '#E0A93B',
  },
]
