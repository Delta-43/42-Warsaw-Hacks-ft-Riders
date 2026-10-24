import type { FixtureFrame } from './fixtures'

export type PanelId = 'stories' | 'metrics' | 'graphs' | 'stats'

export type TourStep = {
  title: string
  caption: string
  durationMs: number
  frame: FixtureFrame
  spotlight: PanelId
  // Pin a Graphs slide (0 momentum, 1 per-rank standings, 2 coalition scores).
  graphSlide?: number
  // Pin a Stats slide by id prefix ('hero', 'coalition', 'analytics').
  statsSlide?: string
}

export type Scenario = {
  id: 'wins' | 'coalitions'
  label: string
  steps: TourStep[]
}

// Scripted, replayable scenarios. They only choose which synthetic fixture
// frame to show and which panels to point at; no network, no randomness.
export const SCENARIOS: Scenario[] = [
  {
    id: 'wins',
    label: 'Recent wins',
    steps: [
      {
        title: 'Stories',
        caption: 'Stories celebrate recent wins: project passes and logtime streaks.',
        durationMs: 7000,
        frame: 0,
        spotlight: 'stories',
        statsSlide: 'hero',
      },
      {
        title: 'A new pass lands',
        caption: 'A fresh pass arrives: Juno Falk just finished cub3d and moves to the front.',
        durationMs: 8000,
        frame: 1,
        spotlight: 'stories',
        statsSlide: 'hero',
      },
      {
        title: 'Heroes of the week',
        caption: 'Streaks build up: Juno tops the logtime board and takes the Hero card.',
        durationMs: 7000,
        frame: 2,
        spotlight: 'stats',
        graphSlide: 0,
        statsSlide: 'hero',
      },
      {
        title: 'Campus pulse',
        caption: 'The metrics strip keeps the whole week in one glance.',
        durationMs: 6000,
        frame: 2,
        spotlight: 'metrics',
        graphSlide: 0,
        statsSlide: 'analytics',
      },
    ],
  },
  {
    id: 'coalitions',
    label: 'Coalition race',
    steps: [
      {
        title: 'Momentum',
        caption: 'Momentum: who is logging the most hours this week.',
        durationMs: 6500,
        frame: 0,
        spotlight: 'graphs',
        graphSlide: 0,
        statsSlide: 'coalition',
      },
      {
        title: 'Standings by rank',
        caption: 'The top 10 scorers of each coalition, rank by rank. Lunaria leads the early ranks.',
        durationMs: 7000,
        frame: 0,
        spotlight: 'graphs',
        graphSlide: 1,
        statsSlide: 'coalition',
      },
      {
        title: 'Orionis closes in',
        caption: 'A big day for Orionis: its score jumps and the gap to Lunaria nearly vanishes.',
        durationMs: 7500,
        frame: 1,
        spotlight: 'graphs',
        graphSlide: 2,
        statsSlide: 'coalition',
      },
      {
        title: 'The lead changes hands',
        caption: 'Orionis overtakes Lunaria. The top 3 per coalition update with it.',
        durationMs: 8000,
        frame: 2,
        spotlight: 'stats',
        graphSlide: 2,
        statsSlide: 'coalition',
      },
    ],
  },
]
