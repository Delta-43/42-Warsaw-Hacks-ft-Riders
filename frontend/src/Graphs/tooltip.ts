import type { CSSProperties } from 'react'

/* Recharts tooltip/cursor styling is passed as inline style objects (props),
   so — like bar_chart.ts — it lives here as data, not CSS. Recharts' default
   tooltip is a sharp-cornered white box with system-default text; this
   matches it to the app's rounded liquid-glass language and Noto Sans
   instead. */

// The highlight rectangle drawn behind the hovered bar/category. Recharts
// reuses the same <Rectangle> mark the bars themselves use, so it takes the
// same `radius` prop — a soft, rounded wash instead of a sharp gray block.
export const TOOLTIP_CURSOR = { fill: 'rgba(255, 255, 255, 0.07)', radius: 8 }

export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: 'rgba(11, 18, 30, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  borderRadius: 12,
  padding: '10px 14px',
  fontFamily: 'var(--font-body)',
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.78rem',
  fontWeight: 600,
  marginBottom: 4,
}

export const TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: 'var(--text-main)',
  fontSize: '0.85rem',
  padding: 0,
}
