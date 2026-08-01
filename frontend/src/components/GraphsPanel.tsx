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
import { CarouselDots } from './CarouselDots'
import { useCarousel } from '../hooks/useCarousel'
import { mockMilestones, mockWeekdayHours } from '../mocks/dashboardData'
import './GraphsPanel.css'

const PIE_COLORS = ['#6FBBF9', '#8AA9F3', '#A597ED', '#AF38CA', '#C979C0', '#E0A93B', '#F7CF6E', '#FBE39A']

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
}

export function GraphsPanel({ historySeries }: GraphsPanelProps) {
  const slides: GraphSlide[] = [
    {
      eyebrow: 'Progress',
      title: 'Students per milestone',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={mockMilestones}
              dataKey="students"
              nameKey="milestone"
              innerRadius="52%"
              outerRadius="88%"
              paddingAngle={3}
            >
              {mockMilestones.map((entry, index) => (
                <Cell key={entry.milestone} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
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
      title: 'Hours logged this week',
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockWeekdayHours}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} />
            <Tooltip />
            <Bar dataKey="hours" radius={[10, 10, 0, 0]} fill="#6FBBF9" />
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
            <Line type="monotone" dataKey="users" stroke="#F7CF6E" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
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
          <p className="eyebrow">{active.eyebrow}</p>
          <h2>{active.title}</h2>
        </div>
        <CarouselDots count={slides.length} activeIndex={index} onSelect={setIndex} ariaLabel="Graph views" />
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
