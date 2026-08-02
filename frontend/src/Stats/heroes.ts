import type { LogtimeTopResponse, ProjectsPassedRecentResponse } from '../App'
import { isKnownTestUser } from '../Global/testUsers'

// "Hero of the week" cards, built from real endpoints only. XP and wallet
// (Altarian Dollars) categories were removed permanently — no endpoint
// anywhere exposes either. Revisit if the backend ever adds one.
//
// A third "top coalition scorer" hero used to live here, but it's now
// redundant with the Stats panel's "Top 3 per coalition" slide (which shows
// the same #1 scorer per coalition, plus 2 more) — dropped to avoid
// repeating the same person/score in two places.
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

export function buildHeroes(logtimeTop: LogtimeTopResponse, projectsPassedRecent: ProjectsPassedRecentResponse): Hero[] {
  const heroes: Hero[] = []

  const topLogtimeUser = logtimeTop.logtime_rankings.items.find((user) => !isKnownTestUser(user.user_id))
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

  const passCounts = new Map<number, { count: number; login: string; imageUrl: string | null }>()
  for (const item of projectsPassedRecent.projects_passed_recent.items) {
    if (isKnownTestUser(item.user_id)) {
      continue
    }
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
