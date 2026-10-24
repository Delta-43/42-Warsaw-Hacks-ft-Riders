import { SCENARIOS } from '../../demo/scenarios'
import type { DemoTour } from '../../demo/useDemoTour'
import styles from './Footer.module.css'

const REPO_URL = 'https://github.com/Delta-43/42-Warsaw-Hacks-ft-Riders'

type FooterProps = {
  tour: DemoTour | null
  paused: boolean
  onTogglePaused: () => void
}

export function Footer({ tour, paused, onTogglePaused }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.controls} role="group" aria-label="Playback">
        {tour && <span className={styles.badge}>Demo data</span>}

        {tour && (
          <p className={styles.caption} role="status">
            <span className={styles.stepCount}>
              {tour.stepIndex + 1}/{tour.scenario.steps.length}
            </span>
            {tour.finished ? 'Tour finished. Replay it or pick another scenario.' : tour.step.caption}
          </p>
        )}
        {!tour && <span className={styles.spacer} />}

        {tour && (
          <div className={styles.segment} role="group" aria-label="Demo scenario">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className={styles.segmentButton}
                aria-pressed={scenario.id === tour.scenario.id}
                onClick={() => tour.select(scenario.id)}
              >
                {scenario.label}
              </button>
            ))}
          </div>
        )}

        <button type="button" className={styles.button} onClick={onTogglePaused} aria-pressed={paused}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        {tour && (
          <button type="button" className={styles.button} onClick={tour.replay}>
            Replay
          </button>
        )}
      </div>

      <p className={styles.credits}>
        <strong>ft_WarsawStories</strong> · 42 Warsaw Hacks, August 2026 (3rd place) · Team ft-Riders: Philip Warda,
        Delta-43 · Licensed{' '}
        <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
          AGPL-3.0
        </a>{' '}
        ·{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
        {tour && ' · All students, logins and numbers shown here are synthetic.'}
      </p>
    </footer>
  )
}
