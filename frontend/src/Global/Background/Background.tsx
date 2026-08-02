import './Background.css'

/**
 * The single rear-most decorative layer for the whole app: two huge,
 * ultra-slow "wave" bands of pastel color, inspired by the macOS
 * Big Sur / Monterey wallpapers. Purely decorative — sits behind every
 * panel, never intercepts clicks, never contains real content.
 *
 * Every tunable value (color, speed, size, blur, opacity, position)
 * lives in Background.css as CSS custom properties on .bg-root, with
 * a guide comment at the top of that file. That's the only place you
 * should need to edit to adjust this.
 */
export function Background() {
  return (
    <div className="bg-root" aria-hidden="true">
      {/* Top wave: further back, slower, drifts right -> left. */}
      <div className="bg-wave bg-wave-top">
        <div className="bg-wave-strip">
          <span className="bg-blob bg-blob-top-a" />
          <span className="bg-blob bg-blob-top-b" />
          <span className="bg-blob bg-blob-top-c" />
          <span className="bg-blob bg-blob-top-a bg-blob-repeat" />
          <span className="bg-blob bg-blob-top-b bg-blob-repeat" />
          <span className="bg-blob bg-blob-top-c bg-blob-repeat" />
        </div>
      </div>

      {/* Bottom wave: foremost of the two, faster, drifts left -> right. */}
      <div className="bg-wave bg-wave-bottom">
        <div className="bg-wave-strip">
          <span className="bg-blob bg-blob-bottom-a" />
          <span className="bg-blob bg-blob-bottom-b" />
          <span className="bg-blob bg-blob-bottom-c" />
          <span className="bg-blob bg-blob-bottom-d" />
          <span className="bg-blob bg-blob-bottom-a bg-blob-repeat" />
          <span className="bg-blob bg-blob-bottom-b bg-blob-repeat" />
          <span className="bg-blob bg-blob-bottom-c bg-blob-repeat" />
          <span className="bg-blob bg-blob-bottom-d bg-blob-repeat" />
        </div>
      </div>
    </div>
  )
}
