import styles from './Background.module.css'

/**
 * The single rear-most decorative layer for the whole app: two huge,
 * ultra-slow "wave" bands of pastel color, inspired by the macOS
 * Big Sur / Monterey wallpapers. Purely decorative — sits behind every
 * panel, never intercepts clicks, never contains real content.
 *
 * Every tunable value (color, speed, size, blur, opacity, position)
 * lives in Background.module.css as CSS custom properties on .bgRoot,
 * with a guide comment at the top of that file. That's the only place
 * you should need to edit to adjust this.
 */
export function Background() {
  return (
    <div className={styles.bgRoot} aria-hidden="true">
      {/* Top wave: further back, slower, drifts right -> left. */}
      <div className={`${styles.bgWave} ${styles.bgWaveTop}`}>
        <div className={styles.bgWaveStrip}>
          <span className={`${styles.bgBlob} ${styles.bgBlobTopA}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobTopB}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobTopC}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobTopA} ${styles.bgBlobRepeat}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobTopB} ${styles.bgBlobRepeat}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobTopC} ${styles.bgBlobRepeat}`} />
        </div>
      </div>

      {/* Bottom wave: foremost of the two, faster, drifts left -> right. */}
      <div className={`${styles.bgWave} ${styles.bgWaveBottom}`}>
        <div className={styles.bgWaveStrip}>
          <span className={`${styles.bgBlob} ${styles.bgBlobBottomA}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobBottomB}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobBottomC}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobBottomD}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobBottomA} ${styles.bgBlobRepeat}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobBottomB} ${styles.bgBlobRepeat}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobBottomC} ${styles.bgBlobRepeat}`} />
          <span className={`${styles.bgBlob} ${styles.bgBlobBottomD} ${styles.bgBlobRepeat}`} />
        </div>
      </div>
    </div>
  )
}
