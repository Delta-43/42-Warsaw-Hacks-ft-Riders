import { type ReactElement } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CoalitionStanding, LogtimeUser } from '../App'
import { PageDots } from '../Global/PageDots/PageDots'
import { useCarousel } from '../Global/hooks/useCarousel'
import { BAR_FILL } from './bar_chart'
import { LINE_STROKE } from './line_chart'
import './graphs_main.css'

type HistorySeriesPoint = {
  label: string
  users: number
}

type GraphSlide = {
  eyebrow: string
  title: string
  chart: ReactElement
}

type GraphsPanelProps = {
  historySeries: HistorySeriesPoint[]
  logtimeLeaders: LogtimeUser[]
  coalitionStandings: CoalitionStanding[]
}

export function GraphsPanel({ historySeries, logtimeLeaders, coalitionStandings }: GraphsPanelProps) {
  const standingsWithScore = coalitionStandings.filter(
    (coalition): coalition is CoalitionStanding & { score: number } => coalition.score !== null,
  )
  const logtimeSeries = logtimeLeaders.map((user) => ({
    login: user.first_name ?? user.login,
    hours: Math.round(user.hours_logged * 10) / 10,
  }))

  const slides: GraphSlide[] = [
    {
      eyebrow: 'Standings',
      title: 'Coalition scores',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={standingsWithScore}
              dataKey="score"
              nameKey="coalition_name"
              innerRadius="52%"
              outerRadius="88%"
              paddingAngle={3}
            >
              {standingsWithScore.map((coalition) => (
                <Cell key={coalition.coalition_id} fill={coalition.color} stroke="none" />
              ))}
            </Pie>
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      ),
    },
    {
      eyebrow: 'Momentum',
      title: 'Logtime leaders this week',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={logtimeSeries}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="login" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} />
            <Tooltip />
            <Bar dataKey="hours" radius={[10, 10, 0, 0]} fill={BAR_FILL} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      eyebrow: 'Timeline',
      title: '42Warsaw student count trend',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={historySeries}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} />
            <YAxis tickLine={false} axisLine={false} width={52} />
            <Tooltip />
            <Line type="monotone" dataKey="users" stroke={LINE_STROKE} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
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

      <div className="graphs-chart-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.title}
            className="graphs-chart-inner"
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
