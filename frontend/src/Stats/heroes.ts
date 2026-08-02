import type { CoalitionTopScorersResponse, LogtimeTopResponse, ProjectsPassedRecentResponse } from '../App'

// "Hero of the week" cards, built from real endpoints only. XP and wallet
// (Altarian Dollars) categories were removed permanently — no endpoint
// anywhere exposes either. Revisit if the backend ever adds one.
export type Hero = {
  id: string
  category: string
  name: string
  value: string
  unit: string
  initials: string
  colorFrom: string
  colorTo: string
  photoUrl: string | null
}

function initialsFor(login: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }
  return login.slice(0, 2).toUpperCase()
}

function fullName(login: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName) {
    return lastName ? `${firstName} ${lastName}` : firstName
  }
  return login
}

export function buildHeroes(
  logtimeTop: LogtimeTopResponse,
  topScorers: CoalitionTopScorersResponse,
  projectsPassedRecent: ProjectsPassedRecentResponse,
): Hero[] {
  const heroes: Hero[] = []

  const topLogtimeUser = logtimeTop.logtime_rankings.items[0]
  if (topLogtimeUser) {
    heroes.push({
      id: 'hours',
      category: 'Most hours logged',
      name: fullName(topLogtimeUser.login, topLogtimeUser.first_name, topLogtimeUser.last_name),
      value: topLogtimeUser.hours_logged.toFixed(0),
      unit: 'hours this week',
      initials: initialsFor(topLogtimeUser.login, topLogtimeUser.first_name, topLogtimeUser.last_name),
      colorFrom: 'var(--avatar-blue-from)',
      colorTo: 'var(--avatar-blue-to)',
      photoUrl: topLogtimeUser.image_url,
    })
  }

  const topScorer = topScorers.top_scorers.items.reduce<
    CoalitionTopScorersResponse['top_scorers']['items'][number] | null
  >((best, item) => (!best || item.score > best.score ? item : best), null)
  if (topScorer) {
    heroes.push({
      id: 'coalition',
      category: `Top ${topScorer.coalition_name} scorer`,
      name: fullName(topScorer.login, topScorer.first_name, topScorer.last_name),
      value: topScorer.score.toLocaleString(),
      unit: 'coalition points',
      initials: initialsFor(topScorer.login, topScorer.first_name, topScorer.last_name),
      colorFrom: 'var(--avatar-purple-from)',
      colorTo: 'var(--avatar-purple-to)',
      // coalitions/top-scorers doesn't carry a photo field per the API contract
      photoUrl: null,
    })
  }

  const passCounts = new Map<number, { count: number; login: string; imageUrl: string | null }>()
  for (const item of projectsPassedRecent.projects_passed_recent.items) {
    const existing = passCounts.get(item.user_id)
    if (existing) {
      existing.count += 1
    } else {
      passCounts.set(item.user_id, { count: 1, login: item.user_login, imageUrl: item.user_image_url })
    }
  }
  let topPasser: { count: number; login: string; imageUrl: string | null } | null = null
  for (const entry of passCounts.values()) {
    if (!topPasser || entry.count > topPasser.count) {
      topPasser = entry
    }
  }
  if (topPasser) {
    heroes.push({
      id: 'projects',
      category: 'Most projects passed this week',
      name: topPasser.login,
      value: String(topPasser.count),
      unit: topPasser.count === 1 ? 'project passed' : 'projects passed',
      initials: topPasser.login.slice(0, 2).toUpperCase(),
      colorFrom: 'var(--avatar-yellow-from)',
      colorTo: 'var(--avatar-yellow-to)',
      photoUrl: topPasser.imageUrl,
    })
  }

  return heroes
}
