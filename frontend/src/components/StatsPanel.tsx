import { AnimatePresence, motion } from 'framer-motion'
import { Avatar } from './Avatar'
import { CarouselDots } from './CarouselDots'
import { useCarousel } from '../hooks/useCarousel'
import { mockHeroes } from '../mocks/dashboardData'
import './StatsPanel.css'

export function StatsPanel() {
  const { index, setIndex } = useCarousel(mockHeroes.length, 6500)
  const hero = mockHeroes[index]

  return (
    <section className="panel glass-panel panel-float stats-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Hero of the week</p>
          <h2>Community shoutouts</h2>
        </div>
        <CarouselDots count={mockHeroes.length} activeIndex={index} onSelect={setIndex} ariaLabel="Hero categories" />
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
              size={140}
              ringWidth={10}
              gapWidth={8}
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
