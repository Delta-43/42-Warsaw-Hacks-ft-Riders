// Fixed name -> color mapping, not palette-index/array-order — so every
// chart that shows the same coalition (pie, grouped bar, legend, swatch)
// always renders it in the same color, regardless of whatever order each
// dataset happens to be sorted in ("color follows the entity, never its
// rank"). Colors are the graph accent palette from Global/styles.css. Only
// 3 of its 5 swatches are used for fills — the two darkest (--graph-navy-950,
// --graph-navy-800) are too low-contrast against these dark glass panels to
// read as chart marks; they're still available as tokens if a future
// non-chart use case wants them.
const COALITION_COLORS: Record<string, string> = {
  Lunaria: 'var(--graph-periwinkle)',
  Orionis: 'var(--graph-coral)',
  Uniterrax: 'var(--graph-peach)',
}

const FALLBACK_PALETTE = ['var(--graph-periwinkle)', 'var(--graph-coral)', 'var(--graph-peach)']

export function colorForCoalition(coalitionName: string, fallbackIndex: number): string {
  return COALITION_COLORS[coalitionName] ?? FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length]
}
