import styles from './Watermark.module.css'

type WatermarkProps = {
  /**
   * 'fixed' pins it to the viewport corner (loading/error screens, which
   * have no card to anchor to). 'corner' anchors it inside a positioned
   * ancestor instead — used to sit it inside the Stats card so it's
   * clipped to that card's own corner instead of hanging over whatever's
   * beneath it.
   */
  variant?: 'fixed' | 'corner'
}

/**
 * Small brand mark. Purely decorative, like <Background /> — never
 * intercepts clicks, never contains real content.
 */
export function Watermark({ variant = 'fixed' }: WatermarkProps) {
  const variantClass = variant === 'corner' ? styles.watermarkCorner : styles.watermarkFixed
  return (
    <span className={`${styles.watermark} ${variantClass}`} aria-hidden="true">
      42 Warsaw
    </span>
  )
}
