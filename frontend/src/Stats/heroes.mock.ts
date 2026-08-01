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
    colorFrom: 'var(--avatar-blue-from)',
    colorTo: 'var(--avatar-blue-to)',
  },
  {
    id: 'xp',
    category: 'Most XP earned',
    name: 'Marek Wiśniewski',
    value: '42,300',
    unit: 'XP this week',
    initials: 'MW',
    colorFrom: 'var(--avatar-purple-from)',
    colorTo: 'var(--avatar-purple-to)',
  },
  {
    id: 'wallet',
    category: 'Most Altarian Dollars',
    name: 'Zofia Nowak',
    value: '128',
    unit: 'Ⱥ$ earned',
    initials: 'ZN',
    colorFrom: 'var(--avatar-yellow-from)',
    colorTo: 'var(--avatar-yellow-to)',
  },
]
