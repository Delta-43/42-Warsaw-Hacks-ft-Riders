import { type ReactElement } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  type LegendPayload,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CoalitionStanding, CoalitionTopScorer, LogtimeUser } from '../App'
import { PageDots } from '../Global/PageDots/PageDots'
import { useCarousel } from '../Global/hooks/useCarousel'
import { groupTopScorersByCoalition } from '../Global/coalitionScorers'
import { colorForCoalition } from '../Global/coalitionPalette'
import { BAR_COLOR, BAR_MAX_SIZE, BAR_RADIUS } from './bar_chart'
import { TOOLTIP_CONTENT_STYLE, TOOLTIP_CURSOR, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from './tooltip'
import styles from './graphs_main.module.css'

// Recharts' default legend colors the text label the same as the series —
// exactly the "text wears the data color" anti-pattern. This renders a
// small colored swatch next to plain ink text instead; identity comes from
// the swatch, not from tinting the word itself.
function ChartLegend({ payload }: { payload?: ReadonlyArray<LegendPayload> }) {
  if (!payload) {
    return null
  }
  return (
    <ul className={styles.chartLegend}>
      {payload.map((entry) => (
        <li key={entry.value} className={styles.chartLegendItem}>
          <span className={styles.chartLegendSwatch} style={{ background: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  )
}

type GraphSlide = {
  eyebrow: string
  title: string
  chart: ReactElement
}

type GraphsPanelProps = {
  logtimeLeaders: LogtimeUser[]
  coalitionStandings: CoalitionStanding[]
  coalitionTopScorers: CoalitionTopScorer[]
}

export function GraphsPanel({ logtimeLeaders, coalitionStandings, coalitionTopScorers }: GraphsPanelProps) {
  const logtimeSeries = logtimeLeaders.map((user) => ({
    login: user.first_name ?? user.login,
    hours: Math.round(user.hours_logged * 10) / 10,
  }))

  const coalitionGroups = groupTopScorersByCoalition(coalitionTopScorers)
  const maxRank = Math.max(0, ...coalitionGroups.flatMap((group) => group.scorers.map((scorer) => scorer.rank ?? 0)))
  const rankSeries = Array.from({ length: maxRank }, (_, index) => {
    const rank = index + 1
    const row: Record<string, number | string> = { rank: `#${rank}` }
    for (const group of coalitionGroups) {
      const scorer = group.scorers.find((item) => item.rank === rank)
      row[group.coalitionName] = scorer ? scorer.score : 0
    }
    return row
  })

  const standingsWithScore = coalitionStandings.filter(
    (coalition): coalition is CoalitionStanding & { score: number } => coalition.score !== null,
  )
  const leader = [...standingsWithScore].sort((a, b) => b.score - a.score)[0]

  const slides: GraphSlide[] = [
    {
      eyebrow: 'Momentum',
      title: 'Logtime leaders this week',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={logtimeSeries} barCategoryGap="24%">
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="login" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={TOOLTIP_CURSOR}
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
            />
            <Bar dataKey="hours" fill={BAR_COLOR} radius={BAR_RADIUS} maxBarSize={BAR_MAX_SIZE} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      eyebrow: 'Standings',
      title: 'Top 10 scorers per coalition',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rankSeries} barGap={2} barCategoryGap="20%">
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="rank" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={52} />
            <Tooltip
              cursor={TOOLTIP_CURSOR}
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
            />
            <Legend verticalAlign="bottom" height={30} content={ChartLegend} />
            {coalitionGroups.map((group, groupIndex) => (
              <Bar
                key={group.coalitionId}
                dataKey={group.coalitionName}
                fill={colorForCoalition(group.coalitionName, groupIndex)}
                radius={BAR_RADIUS}
                maxBarSize={BAR_MAX_SIZE}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      eyebrow: 'Standings',
      title: 'Coalition scores',
      chart: (
        <div className={styles.coalitionScoresSlide}>
          {leader && (
            <div className={styles.coalitionLeader}>
              <span
                className={styles.coalitionLeaderSwatch}
                style={{ background: colorForCoalition(leader.coalition_name, 0) }}
              />
              <p className={styles.coalitionLeaderName}>{leader.coalition_name}</p>
              <p className={styles.coalitionLeaderScore}>{leader.score.toLocaleString()} pts</p>
            </div>
          )}
          <div className={styles.coalitionScoresChart}>
            <div className={styles.coalitionScoresChartSquare}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={standingsWithScore}
                    dataKey="score"
                    nameKey="coalition_name"
                    innerRadius="52%"
                    outerRadius="88%"
                    paddingAngle={4}
                  >
                    {standingsWithScore.map((coalition, coalitionIndex) => (
                      <Cell
                        key={coalition.coalition_id}
                        fill={colorForCoalition(coalition.coalition_name, coalitionIndex)}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ),
    },
  ]

  const { index, setIndex } = useCarousel(slides.length, 7000)
  const active = slides[index]

  return (
    <section className="panel glass-panel panel-float graphs-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow eyebrow-on-color">{active.eyebrow}</p>
          <h2>{active.title}</h2>
        </div>
        <PageDots count={slides.length} activeIndex={index} onSelect={setIndex} ariaLabel="Graph views" />
      </header>

      <div className={styles.graphsChartStage}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active.title}
            className={styles.graphsChartInner}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            {active.chart}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
