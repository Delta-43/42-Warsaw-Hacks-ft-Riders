import { Avatar } from './Avatar'
import { mockStudents } from '../mocks/dashboardData'
import './StoriesPanel.css'

export function StoriesPanel() {
  return (
    <section className="panel glass-panel panel-float stories-panel">
      <div className="stories-row">
        {mockStudents.map((student) => (
          <div key={student.id} className="story-item">
            <Avatar
              name={student.name}
              initials={student.initials}
              colorFrom={student.colorFrom}
              colorTo={student.colorTo}
              size={110}
              ringWidth={4.8}
              gapWidth={4.8}
            />
            <span className="story-name">{student.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
