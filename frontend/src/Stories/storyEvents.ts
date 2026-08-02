import type { LogtimeTopResponse, ProjectsPassedRecentResponse } from '../App'

// Real activity feed for the Stories carousel — no invented stats. Built from
// two live endpoints: recent project passes (freshest, narrative-friendly —
// "recently completed X") and this week's logtime leaders (for variety once
// recent passes run out). A user appearing in both only gets one card, in
// whichever list we visit first.
export type StoryEvent = {
  id: string
  login: string
  name: string
  initials: string
  colorFrom: string
  colorTo: string
  photoUrl: string | null
  kind: 'project_pass' | 'logtime'
  projectName?: string
  hoursLogged?: number
}

const AVATAR_PALETTE: Array<[string, string]> = [
  ['var(--avatar-blue-from)', 'var(--avatar-blue-to)'],
  ['var(--avatar-purple-from)', 'var(--avatar-purple-to)'],
  ['var(--avatar-yellow-from)', 'var(--avatar-yellow-to)'],
  ['var(--avatar-mint-from)', 'var(--avatar-mint-to)'],
  ['var(--avatar-red-from)', 'var(--avatar-red-to)'],
]

function initialsFor(login: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }
  return login.slice(0, 2).toUpperCase()
}

export function buildStoryEvents(
  logtimeTop: LogtimeTopResponse,
  projectsPassedRecent: ProjectsPassedRecentResponse,
): StoryEvent[] {
  const seenUserIds = new Set<number>()
  const events: StoryEvent[] = []
  let colorIndex = 0

  const nextColorPair = () => {
    const [colorFrom, colorTo] = AVATAR_PALETTE[colorIndex % AVATAR_PALETTE.length]
    colorIndex += 1
    return { colorFrom, colorTo }
  }

  for (const pass of projectsPassedRecent.projects_passed_recent.items) {
    if (seenUserIds.has(pass.user_id)) {
      continue
    }
    seenUserIds.add(pass.user_id)
    events.push({
      id: `pass-${pass.user_id}-${pass.project_id}`,
      login: pass.user_login,
      name: pass.user_login,
      initials: pass.user_login.slice(0, 2).toUpperCase(),
      photoUrl: pass.user_image_url,
      kind: 'project_pass',
      projectName: pass.project_name,
      ...nextColorPair(),
    })
  }

  for (const user of logtimeTop.logtime_rankings.items) {
    if (seenUserIds.has(user.user_id)) {
      continue
    }
    seenUserIds.add(user.user_id)
    events.push({
      id: `logtime-${user.user_id}`,
      login: user.login,
      name: user.first_name ?? user.login,
      initials: initialsFor(user.login, user.first_name, user.last_name),
      photoUrl: user.image_url,
      kind: 'logtime',
      hoursLogged: user.hours_logged,
      ...nextColorPair(),
    })
  }

  return events
}
