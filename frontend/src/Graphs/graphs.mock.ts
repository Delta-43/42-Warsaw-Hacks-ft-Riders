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
