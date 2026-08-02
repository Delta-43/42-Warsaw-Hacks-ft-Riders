import styles from './Avatar.module.css'

// Ring/gap thickness as a fraction of avatar size. Every avatar in the app
// goes through this one formula by default, so the border reads the same
// visual weight at any size instead of each call site guessing its own
// absolute px value.
const RING_RATIO = 0.045
const GAP_RATIO = 0.045

// Call sites pass sizes as "px at the reference viewport" — the same
// numbers as before this component scaled with the page. Rendering them in
// rem (rather than raw px) is what makes avatar photos grow/shrink with the
// responsive root font-size (see Global/styles.css) instead of staying a
// fixed pixel size while the rest of the page scales around them. Must
// match the root font-size that CSS resolves to at the reference viewport
// (1920x1080) — keep in sync with Global/styles.css if that base changes,
// otherwise avatars would silently scale relative to text instead of
// staying visually the same size a caller asked for.
const REFERENCE_PX_PER_REM = 18

// Avatars track the page's responsive scale but are clamped to a narrower
// band than plain text — below FLOOR_RATIO they stop shrinking (a small
// window shouldn't make faces illegible) and above CEILING_RATIO they stop
// growing (a huge screen shouldn't blow up what are often modest hotlinked
// photos into something soft/blurry). Every size passed through this same
// clamp (ring/gap/font included) moves in lockstep, so proportions never
// drift even while clamped.
const FLOOR_RATIO = 0.85
const CEILING_RATIO = 1.3

function rem(px: number): string {
  return `clamp(${px * FLOOR_RATIO}px, ${px / REFERENCE_PX_PER_REM}rem, ${px * CEILING_RATIO}px)`
}

type AvatarProps = {
  name: string
  initials: string
  colorFrom: string
  colorTo: string
  photoUrl?: string | null
  size?: number
  ringWidth?: number
  gapWidth?: number
  // Lets a caller extend the outer ring's styling (e.g. Stories' active-tier
  // glow) by composing a scoped class from its own module, instead of
  // reaching into Avatar's internals via a cross-file CSS selector.
  className?: string
}

export function Avatar({
  name,
  initials,
  colorFrom,
  colorTo,
  photoUrl,
  size = 96,
  ringWidth,
  gapWidth,
  className,
}: AvatarProps) {
  const resolvedRingWidth = ringWidth ?? size * RING_RATIO
  const resolvedGapWidth = gapWidth ?? size * GAP_RATIO

  return (
    <span
      className={className ? `${styles.avatarRing} ${className}` : styles.avatarRing}
      role="img"
      aria-label={name}
      style={{ width: rem(size), height: rem(size), padding: rem(resolvedRingWidth), background: 'var(--avatar-ring-gradient)' }}
    >
      <span className={styles.avatarGap} style={{ padding: rem(resolvedGapWidth) }}>
        <span
          className={styles.avatarPhoto}
          style={{
            background: `linear-gradient(160deg, ${colorFrom}, ${colorTo})`,
            fontSize: rem(size * 0.32),
          }}
        >
          {initials}
          {photoUrl && (
            <img
              className={styles.avatarPhotoImg}
              src={photoUrl}
              alt=""
              loading="lazy"
              // Real 42 profile photos are hotlinked from intra's CDN and
              // occasionally 404/expire — on failure just hide the image so
              // the initials underneath (already rendered) show through
              // instead of a broken-image icon. No component state needed.
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          )}
        </span>
      </span>
    </span>
  )
}
