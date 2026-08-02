/* Recharts renders SVG with inline attributes, so bar-chart colour config lives here as data, not CSS. */

// The logtime-leaders chart has no real categorical grouping — each bar is
// just a different student, ranked by hours. Per dataviz convention, nominal
// data with no grouping meaning gets ONE color for every bar, not a rotating
// hue per bar (that miscodes it as multi-series data it isn't, and reads as
// a loud, arbitrary rainbow). Graph-accent periwinkle (Global/styles.css) —
// the graph palette, not the avatar-ring palette.
export const BAR_COLOR = 'var(--graph-periwinkle)'

// Bar/column mark spec: capped thickness so a bar never fills its slot, and
// a small rounded data-end rather than a big pill cap.
export const BAR_MAX_SIZE = 24
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]
