import type {
  AchievementsEarnedWeeklyResponse,
  AnalyticsPillsResponse,
  AttendanceWeeklyResponse,
  ProjectActivityWeeklyResponse,
} from '../App'
import styles from './metrics_strip.module.css'

type MetricsStripProps = {
  analytics: AnalyticsPillsResponse['analytics']
  achievementsEarnedWeekly: AchievementsEarnedWeeklyResponse
  projectActivityWeekly: ProjectActivityWeeklyResponse
  attendanceWeekly: AttendanceWeeklyResponse
}

export function MetricsStrip({
  analytics,
  achievementsEarnedWeekly,
  projectActivityWeekly,
  attendanceWeekly,
}: MetricsStripProps) {
  const tiles = [
    {
      id: 'students',
      value: analytics.users.total.toLocaleString(),
      label: '42Warsaw students',
    },
    {
      id: 'achievements',
      value: Math.round(achievementsEarnedWeekly.weekly_achievements_earned.metric_value).toLocaleString(),
      label: 'Achievements earned this week',
    },
    {
      id: 'projects',
      value: projectActivityWeekly.project_activity.active_or_started_projects_count.toLocaleString(),
      label: 'Projects worked on this week',
    },
    {
      id: 'attendance',
      value: attendanceWeekly.attendance.unique_students_count.toLocaleString(),
      label: 'Students on campus this week',
    },
  ]

  return (
    <section className="panel glass-panel panel-float metrics-strip">
      {tiles.map((tile) => (
        <div key={tile.id} className={styles.metricsTile}>
          <span className={styles.metricsValue}>{tile.value}</span>
          <span className={styles.metricsLabel}>{tile.label}</span>
        </div>
      ))}
    </section>
  )
}
