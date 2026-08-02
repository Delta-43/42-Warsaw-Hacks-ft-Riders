import { type ReactElement } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AnalyticsPillsResponse, CoalitionTopScorer } from '../App'
import { Avatar } from '../Global/Avatars/Avatar'
import { PageDots } from '../Global/PageDots/PageDots'
import { Watermark } from '../Global/Watermark/Watermark'
import { useCarousel } from '../Global/hooks/useCarousel'
import { groupTopScorersByCoalition } from '../Global/coalitionScorers'
import { colorForCoalition } from '../Global/coalitionPalette'
import type { Hero } from './heroes'
import heroStyles from './hero_of_the_week.module.css'
import statsStyles from './stats.module.css'
import styles from './stats_main.module.css'

type StatsPanelProps = {
  heroes: Hero[]
  coalitionTopScorers: CoalitionTopScorer[]
  analytics: AnalyticsPillsResponse['analytics']
}

type StatsSlide = {
  id: string
  eyebrow: string
  title: string
  content: ReactElement
}

export function StatsPanel({ heroes, coalitionTopScorers, analytics }: StatsPanelProps) {
  const slides: StatsSlide[] = []

  for (const hero of heroes) {
    slides.push({
      id: `hero-${hero.id}`,
      eyebrow: 'Hero of the week',
      title: hero.category,
      content: (
        <article className={heroStyles.heroCard}>
          <Avatar
            name={hero.name}
            initials={hero.initials}
            colorFrom={hero.colorFrom}
            colorTo={hero.colorTo}
            photoUrl={hero.photoUrl}
            size={140}
          />
          <p className={heroStyles.heroCategory}>{hero.category}</p>
          <h3 className={heroStyles.heroName}>{hero.name}</h3>
          <div className={heroStyles.heroValue}>{hero.value}</div>
          <p className={heroStyles.heroUnit}>{hero.unit}</p>
        </article>
      ),
    })
  }

  const coalitionGroups = groupTopScorersByCoalition(coalitionTopScorers)
  if (coalitionGroups.length > 0) {
    slides.push({
      id: 'coalition-top3',
      eyebrow: 'Standings',
      title: 'Top 3 per coalition',
      content: (
        <div className={statsStyles.coalitionTop3}>
          {coalitionGroups.map((group, groupIndex) => (
            <div key={group.coalitionId} className={statsStyles.coalitionTop3Group}>
              <p className={statsStyles.coalitionTop3Name}>
                <span
                  className={statsStyles.coalitionTop3Swatch}
                  style={{ background: colorForCoalition(group.coalitionName, groupIndex) }}
                />
                {group.coalitionName}
              </p>
              <ol className={statsStyles.coalitionTop3List}>
                {group.scorers.slice(0, 3).map((scorer) => (
                  <li key={scorer.user_id}>
                    <span className={statsStyles.coalitionTop3Rank}>#{scorer.rank}</span>
                    <span className={statsStyles.coalitionTop3ScorerName}>{scorer.first_name ?? scorer.login}</span>
                    <span className={statsStyles.coalitionTop3Score}>{scorer.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ),
    })
  }

  slides.push({
    id: 'analytics-summary',
    eyebrow: 'Analytics',
    title: 'Campus snapshot',
    content: (
      <div className={statsStyles.analyticsGrid}>
        <div className={statsStyles.analyticsTile}>
          <span className={statsStyles.analyticsValue}>{analytics.users.active.toLocaleString()}</span>
          <span className={statsStyles.analyticsLabel}>Active students</span>
        </div>
        <div className={statsStyles.analyticsTile}>
          <span className={statsStyles.analyticsValue}>{Math.round(analytics.users.active_ratio * 100)}%</span>
          <span className={statsStyles.analyticsLabel}>Active ratio</span>
        </div>
        <div className={statsStyles.analyticsTile}>
          <span className={statsStyles.analyticsValue}>
            {Math.round(analytics.coalition_scores.avg_user_score).toLocaleString()}
          </span>
          <span className={statsStyles.analyticsLabel}>Avg coalition score</span>
        </div>
        <div className={statsStyles.analyticsTile}>
          <span className={statsStyles.analyticsValue}>{analytics.coalition_scores.top_user_score.toLocaleString()}</span>
          <span className={statsStyles.analyticsLabel}>Top coalition score</span>
        </div>
        <div className={statsStyles.analyticsTile}>
          <span className={statsStyles.analyticsValue}>{analytics.coalition_scores.ranked_users.toLocaleString()}</span>
          <span className={statsStyles.analyticsLabel}>Ranked students</span>
        </div>
      </div>
    ),
  })

  const { index, setIndex } = useCarousel(slides.length, 6500)

  if (slides.length === 0) {
    return (
      <section className="panel glass-panel panel-float stats-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow eyebrow-on-color">Stats</p>
            <h2>Community shoutouts</h2>
          </div>
        </header>
        <p className={styles.statsEmpty}>No leaderboard data yet</p>
        <Watermark variant="corner" />
      </section>
    )
  }

  const active = slides[index]

  return (
    <section className="panel glass-panel panel-float stats-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow eyebrow-on-color">{active.eyebrow}</p>
          <h2>{active.title}</h2>
        </div>
        <PageDots count={slides.length} activeIndex={index} onSelect={setIndex} ariaLabel="Stats views" />
      </header>

      <div className={styles.statsStage}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            className={styles.statsSlide}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            {active.content}
          </motion.div>
        </AnimatePresence>
      </div>
      <Watermark variant="corner" />
    </section>
  )
}
