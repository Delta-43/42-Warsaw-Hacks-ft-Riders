export type Student = {
  id: number
  name: string
  initials: string
  colorFrom: string
  colorTo: string
  // Placeholder until the backend feeds real intra login / XP / wallet / project data.
  intraLogin: string
  xp: number
  wallet: number
  lastProject: string
}

const AVATAR_PALETTE: Array<[string, string]> = [
  ['var(--avatar-blue-from)', 'var(--avatar-blue-to)'],
  ['var(--avatar-purple-from)', 'var(--avatar-purple-to)'],
  ['var(--avatar-yellow-from)', 'var(--avatar-yellow-to)'],
  ['var(--avatar-mint-from)', 'var(--avatar-mint-to)'],
  ['var(--avatar-red-from)', 'var(--avatar-red-to)'],
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

const LAST_PROJECTS = [
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
  'webserv',
  'ft_transcendence',
]

function initialsFor(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function loginFor(name: string): string {
  const [first, last] = name.split(' ')
  return `${first.toLowerCase()}${last ? last[0].toLowerCase() : ''}`
}

export function formatXp(xp: number): string {
  if (xp < 1000) {
    return String(xp)
  }
  const value = xp / 1000
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}k`
}

export const mockStudents: Student[] = STUDENT_NAMES.map((name, index) => {
  const [colorFrom, colorTo] = AVATAR_PALETTE[index % AVATAR_PALETTE.length]
  return {
    id: index + 1,
    name,
    initials: initialsFor(name),
    colorFrom,
    colorTo,
    intraLogin: loginFor(name),
    xp: 1200 + ((index * 733) % 6400),
    wallet: 80 + ((index * 137) % 900),
    lastProject: LAST_PROJECTS[index % LAST_PROJECTS.length],
  }
})
