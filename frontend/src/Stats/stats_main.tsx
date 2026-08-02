import { AnimatePresence, motion } from 'framer-motion'
import { Avatar } from '../Global/Avatars/Avatar'
import { PageDots } from '../Global/PageDots/PageDots'
import { useCarousel } from '../Global/hooks/useCarousel'
import type { Hero } from './heroes'
import './hero_of_the_week.css'
import './stats.css'
import './stats_main.css'

type StatsPanelProps = {
  heroes: Hero[]
}

export function StatsPanel({ heroes }: StatsPanelProps) {
  const { index, setIndex } = useCarousel(heroes.length, 6500)

  if (heroes.length === 0) {
    return (
      <section className="panel glass-panel panel-float stats-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow eyebrow-on-color">Hero of the week</p>
            <h2>Community shoutouts</h2>
          </div>
        </header>
        <p className="stats-empty">No leaderboard data yet</p>
      </section>
    )
  }

  const hero = heroes[index]

  return (
    <section className="panel glass-panel panel-float stats-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow eyebrow-on-color">Hero of the week</p>
          <h2>Community shoutouts</h2>
        </div>
        <PageDots count={heroes.length} activeIndex={index} onSelect={setIndex} ariaLabel="Hero categories" />
      </header>

      <div className="stats-stage">
        <AnimatePresence mode="wait">
          <motion.article
            key={hero.id}
            className="hero-card"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <Avatar
              name={hero.name}
              initials={hero.initials}
              colorFrom={hero.colorFrom}
              colorTo={hero.colorTo}
              photoUrl={hero.photoUrl}
              size={140}
            />
            <p className="hero-category">{hero.category}</p>
            <h3 className="hero-name">{hero.name}</h3>
            <div className="hero-value">{hero.value}</div>
            <p className="hero-unit">{hero.unit}</p>
          </motion.article>
        </AnimatePresence>
      </div>
    </section>
  )
}
