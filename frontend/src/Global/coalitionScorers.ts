import type { CoalitionTopScorer } from '../App'

export type CoalitionScorerGroup = {
  coalitionId: number
  coalitionName: string
  color: string
  scorers: CoalitionTopScorer[]
}

// Shared by Stats (top 3 per coalition) and Graphs (full top 10 per
// coalition) — both need the same top-scorers dataset grouped by coalition
// and sorted by rank, just sliced to a different depth.
export function groupTopScorersByCoalition(items: CoalitionTopScorer[]): CoalitionScorerGroup[] {
  const groups = new Map<number, CoalitionScorerGroup>()

  for (const item of items) {
    let group = groups.get(item.coalition_id)
    if (!group) {
      group = { coalitionId: item.coalition_id, coalitionName: item.coalition_name, color: item.color, scorers: [] }
      groups.set(item.coalition_id, group)
    }
    group.scorers.push(item)
  }

  for (const group of groups.values()) {
    group.scorers.sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
  }

  return Array.from(groups.values()).sort((a, b) => a.coalitionName.localeCompare(b.coalitionName))
}
