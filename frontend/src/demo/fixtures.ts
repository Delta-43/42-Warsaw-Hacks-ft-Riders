import type { DashboardData, ProjectPass } from '../App'

// ---------------------------------------------------------------------------
// SYNTHETIC DEMO DATA
//
// Everything in this file is invented. No name, login, score or count below
// comes from the 42 Intra API or from any real student; the people are
// fictional and the numbers are scripted so the demo tells a story. Only
// public, non-personal labels are real: the three Warsaw coalition names and
// colours, and the public 42 curriculum project names.
//
// `buildFixture(frame)` returns one complete dashboard snapshot. Frames
// 0 -> 2 move the story forward (a new project pass lands, logtime shifts,
// the coalition lead changes hands) so the guided tour has something to show.
// ---------------------------------------------------------------------------

export type FixtureFrame = 0 | 1 | 2

const CAMPUS_ID = 67
// Fixed anchor so every load renders the same scripted week.
const ANCHOR = Date.parse('2026-08-22T12:00:00Z')
const hoursAgo = (hours: number) => new Date(ANCHOR - hours * 3_600_000).toISOString()
const WEEK_START = hoursAgo(7 * 24).slice(0, 10)

type Person = { first: string; last: string; login: string }

const person = (first: string, last: string): Person => ({
  first,
  last,
  login: `${first[0]}${last}`.toLowerCase().slice(0, 8),
})

// Fictional spotlight cast (stories, logtime, heroes).
const CAST = {
  mira: person('Mira', 'Voss'),
  tobias: person('Tobias', 'Wren'),
  isolde: person('Isolde', 'Marsh'),
  callum: person('Callum', 'Reyes'),
  priya: person('Priya', 'Okafor'),
  anselm: person('Anselm', 'Dray'),
  juno: person('Juno', 'Falk'),
  wilhelmina: person('Wilhelmina', 'Cross'),
  ravi: person('Ravi', 'Lindqvist'),
  odette: person('Odette', 'Brandt'),
}

// Fictional pool for the per-coalition leaderboards: 10 per coalition, no
// repeats across coalitions.
const FIRST = [
  'Alder', 'Briar', 'Cato', 'Dahlia', 'Egon', 'Fenna', 'Gideon', 'Hazel', 'Ines', 'Jasper',
  'Kira', 'Lorcan', 'Maren', 'Nils', 'Oriel', 'Pia', 'Quill', 'Rafe', 'Sable', 'Teo',
  'Una', 'Viggo', 'Willa', 'Xavi', 'Yara', 'Zeno', 'Bram', 'Cleo', 'Dov', 'Elke',
]
const LAST = [
  'Ashby', 'Bellweather', 'Corvin', 'Dunmore', 'Eastlake', 'Fairchild', 'Garrow', 'Hollis', 'Ivers', 'Juniper',
  'Kestrel', 'Lowell', 'Marlow', 'Northcott', 'Ostrander', 'Pennick', 'Quarry', 'Rowan', 'Sterling', 'Thorne',
  'Umber', 'Vance', 'Wickham', 'Yarrow', 'Zephyr', 'Alcott', 'Brightwater', 'Calloway', 'Delacroix', 'Emberly',
]
const POOL: Person[] = FIRST.map((first, index) => person(first, LAST[(index * 7 + 3) % LAST.length]))

const LOGTIME: Array<{ who: Person; hours: number }> = [
  { who: CAST.mira, hours: 44.2 },
  { who: CAST.tobias, hours: 39.8 },
  { who: CAST.isolde, hours: 36.1 },
  { who: CAST.callum, hours: 32.7 },
  { who: CAST.priya, hours: 29.4 },
  { who: CAST.anselm, hours: 26.9 },
  { who: CAST.juno, hours: 23.5 },
  { who: CAST.wilhelmina, hours: 21.0 },
  { who: CAST.ravi, hours: 18.6 },
  { who: CAST.odette, hours: 16.2 },
]

// Extra hours earned per frame (a "streak" building up for Juno).
const LOGTIME_BONUS: Record<FixtureFrame, Record<string, number>> = {
  0: {},
  1: { [CAST.juno.login]: 12.0, [CAST.odette.login]: 2.0 },
  2: { [CAST.juno.login]: 22.0, [CAST.odette.login]: 5.5, [CAST.priya.login]: 1.2 },
}

const BASE_PASSES: Array<{ who: Person; project: string; hoursAgo: number }> = [
  { who: CAST.tobias, project: 'push_swap', hoursAgo: 3 },
  { who: CAST.isolde, project: 'minitalk', hoursAgo: 9 },
  { who: CAST.callum, project: 'so_long', hoursAgo: 15 },
  { who: CAST.priya, project: 'libft', hoursAgo: 22 },
  { who: CAST.anselm, project: 'get_next_line', hoursAgo: 31 },
  { who: CAST.wilhelmina, project: 'philosophers', hoursAgo: 40 },
  { who: CAST.ravi, project: 'netpractice', hoursAgo: 52 },
]

// Fresh passes that "arrive" as the story advances.
const FRESH_PASSES: Record<FixtureFrame, Array<{ who: Person; project: string; hoursAgo: number }>> = {
  0: [],
  1: [{ who: CAST.juno, project: 'cub3d', hoursAgo: 0.2 }],
  2: [
    { who: CAST.odette, project: 'minishell', hoursAgo: 0.1 },
    { who: CAST.juno, project: 'cub3d', hoursAgo: 1.4 },
  ],
}

// Stable ids per person so the same person is the same user in every list.
const userId = (login: string) => 9000 + [...login].reduce((sum, char) => sum + char.charCodeAt(0), 0)

function passes(frame: FixtureFrame): ProjectPass[] {
  const all = [...FRESH_PASSES[frame], ...BASE_PASSES]
  return all.map((entry, index) => ({
    user_id: userId(entry.who.login),
    project_id: 100 + index,
    project_name: entry.project,
    projects_user_id: 5000 + index,
    marked_at: hoursAgo(entry.hoursAgo),
    user_login: entry.who.login,
    first_name: entry.who.first,
    last_name: entry.who.last,
    user_image_url: null,
    user_profile_url: '',
    collected_at: hoursAgo(entry.hoursAgo),
  }))
}

const COALITIONS = [
  { id: 459, name: 'Lunaria', slug: 'lunaria', color: '#52BDFF' },
  { id: 458, name: 'Orionis', slug: 'orionis', color: '#BE2AD1' },
  { id: 460, name: 'Uniterrax', slug: 'uniterrax', color: '#FFCD5A' },
]

// Scripted totals: Lunaria leads, then Orionis closes in and overtakes.
const COALITION_SCORES: Record<FixtureFrame, Record<string, number>> = {
  0: { Lunaria: 41200, Orionis: 38800, Uniterrax: 36100 },
  1: { Lunaria: 42350, Orionis: 41900, Uniterrax: 38400 },
  2: { Lunaria: 42900, Orionis: 45300, Uniterrax: 40200 },
}

export function buildFixture(frame: FixtureFrame): DashboardData {
  const stamp = hoursAgo(0)
  const bonus = LOGTIME_BONUS[frame]

  const logtimeItems = LOGTIME.map(({ who, hours }, index) => ({
    who,
    hours: Math.round((hours + (bonus[who.login] ?? 0)) * 10) / 10,
    index,
  })).sort((a, b) => b.hours - a.hours)

  return {
    logtimeTop: {
      source_mode: 'fresh_cache',
      data_timestamp: stamp,
      logtime_rankings: {
        campus_id: CAMPUS_ID,
        week_start_date: WEEK_START,
        total: logtimeItems.length,
        items: logtimeItems.map(({ who, hours, index }) => ({
          user_id: userId(who.login),
          seconds_logged: Math.round(hours * 3600),
          sessions_count: 8 + index,
          week_start_date: WEEK_START,
          collected_at: hoursAgo(1),
          login: who.login,
          first_name: who.first,
          last_name: who.last,
          image_url: null,
          hours_logged: hours,
        })),
      },
    },
    projectsPassedRecent: {
      source_mode: 'fresh_cache',
      data_timestamp: stamp,
      projects_passed_recent: {
        campus_id: CAMPUS_ID,
        window_hours: 168,
        total: passes(frame).length,
        items: passes(frame),
      },
    },
    coalitionStandings: {
      source_mode: 'fresh_cache',
      data_timestamp: stamp,
      standings: {
        campus_id: CAMPUS_ID,
        total: COALITIONS.length,
        items: COALITIONS.map((coalition) => ({
          coalition_id: coalition.id,
          campus_id: CAMPUS_ID,
          cursus_id: 21,
          coalition_name: coalition.name,
          slug: coalition.slug,
          image_url: null,
          cover_url: null,
          color: coalition.color,
          score: COALITION_SCORES[frame][coalition.name],
          score_collected_at: hoursAgo(1),
          last_seen_at: stamp,
        })),
      },
    },
    coalitionTopScorers: {
      source_mode: 'fresh_cache',
      data_timestamp: stamp,
      top_scorers: {
        campus_id: CAMPUS_ID,
        total: COALITIONS.length * 10,
        items: COALITIONS.flatMap((coalition, coalitionIndex) => {
          // Scorers' totals scale with the coalition total, so a coalition on
          // the rise lifts its whole leaderboard.
          const scale = COALITION_SCORES[frame][coalition.name] / 40000
          return Array.from({ length: 10 }, (_, rankIndex) => {
            const who = POOL[coalitionIndex * 10 + rankIndex]
            return {
              coalition_id: coalition.id,
              user_id: 20000 + coalitionIndex * 100 + rankIndex,
              score: Math.round((4300 - rankIndex * 310 - coalitionIndex * 90) * scale),
              rank: rankIndex + 1,
              collected_at: hoursAgo(1),
              coalition_name: coalition.name,
              slug: coalition.slug,
              color: coalition.color,
              login: who.login,
              first_name: who.first,
              last_name: who.last,
            }
          })
        }),
      },
    },
    attendanceWeekly: {
      source_mode: 'fresh_cache',
      data_timestamp: stamp,
      attendance: {
        campus_id: CAMPUS_ID,
        week_start_date: WEEK_START,
        unique_students_count: 301 + frame * 9,
        collected_at: hoursAgo(1),
      },
    },
    projectActivityWeekly: {
      source_mode: 'fresh_cache',
      data_timestamp: stamp,
      project_activity: {
        campus_id: CAMPUS_ID,
        week_start_date: WEEK_START,
        active_or_started_projects_count: 174 + frame * 6,
        created_events_count: 28,
        updated_events_count: 41,
        collected_at: hoursAgo(1),
      },
    },
    achievementsEarnedWeekly: {
      source_mode: 'fresh_cache',
      data_timestamp: stamp,
      weekly_achievements_earned: {
        metric_name: 'weekly_achievements_earned',
        metric_value: 76 + frame * 5,
        collected_at: hoursAgo(1),
        source_status: 'demo_fixture',
        payload: { week_start_date: WEEK_START, window_end_date: hoursAgo(0).slice(0, 10) },
      },
    },
    analyticsPills: {
      source_mode: 'fresh_cache',
      data_timestamp: stamp,
      analytics: {
        campus_id: CAMPUS_ID,
        users: { total: 1480, active: 340 + frame * 7, active_ratio: (340 + frame * 7) / 1480 },
        achievements: { earned_this_week: 76 + frame * 5 },
        coalition_scores: { avg_user_score: 1180.5, top_user_score: 4300, ranked_users: 480 },
      },
    },
  }
}
