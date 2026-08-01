export type Student = {
  id: number
  name: string
  initials: string
  colorFrom: string
  colorTo: string
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
