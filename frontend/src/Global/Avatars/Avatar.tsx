import './Avatar.css'

// Ring/gap thickness as a fraction of avatar size. Every avatar in the app
// goes through this one formula by default, so the border reads the same
// visual weight at any size instead of each call site guessing its own
// absolute px value.
const RING_RATIO = 0.045
const GAP_RATIO = 0.045

type AvatarProps = {
  name: string
  initials: string
  colorFrom: string
  colorTo: string
  photoUrl?: string | null
  size?: number
  ringWidth?: number
  gapWidth?: number
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
}: AvatarProps) {
  const resolvedRingWidth = ringWidth ?? size * RING_RATIO
  const resolvedGapWidth = gapWidth ?? size * GAP_RATIO

  return (
    <span
      className="avatar-ring"
      role="img"
      aria-label={name}
      style={{ width: size, height: size, padding: resolvedRingWidth, background: 'var(--avatar-ring-gradient)' }}
    >
      <span className="avatar-gap" style={{ padding: resolvedGapWidth }}>
        <span
          className="avatar-photo"
          style={{
            background: `linear-gradient(160deg, ${colorFrom}, ${colorTo})`,
            fontSize: size * 0.32,
          }}
        >
          {initials}
          {photoUrl && (
            <img
              className="avatar-photo-img"
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
