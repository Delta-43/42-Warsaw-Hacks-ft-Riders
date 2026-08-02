import styles from './Watermark.module.css'

/**
 * Small page-level brand mark, fixed to the bottom-right corner of the
 * viewport. Purely decorative, like <Background /> — never intercepts
 * clicks, never contains real content.
 */
export function Watermark() {
  return (
    <span className={styles.watermark} aria-hidden="true">
      42 Warsaw
    </span>
  )
}
