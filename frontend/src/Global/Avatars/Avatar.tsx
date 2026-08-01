import './Avatar.css'

type AvatarProps = {
  name: string
  initials: string
  colorFrom: string
  colorTo: string
  size?: number
  ringWidth?: number
  gapWidth?: number
}

export function Avatar({
  name,
  initials,
  colorFrom,
  colorTo,
  size = 96,
  ringWidth = 12,
  gapWidth = 12,
}: AvatarProps) {
  return (
    <span
      className="avatar-ring"
      role="img"
      aria-label={name}
      style={{ width: size, height: size, padding: ringWidth, background: 'var(--avatar-ring-gradient)' }}
    >
      <span className="avatar-gap" style={{ padding: gapWidth }}>
        <span
          className="avatar-photo"
          style={{
            background: `linear-gradient(160deg, ${colorFrom}, ${colorTo})`,
            fontSize: size * 0.32,
          }}
        >
          {initials}
        </span>
      </span>
    </span>
  )
}
