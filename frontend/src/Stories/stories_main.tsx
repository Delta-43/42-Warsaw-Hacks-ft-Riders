import { AnimatePresence, motion } from 'framer-motion'
import { Avatar } from '../Global/Avatars/Avatar'
import { SpeechBubble } from './SpeechBubble'
import { mockStudents, type Student } from './students.mock'
import { useStoryCycle } from './useStoryCycle'
import './carousel.css'
import './speech_bubbles.css'
import './stories_main.css'

const WINDOW_SIZE = 8
const ITEM_WIDTH = 150
const ITEM_HALF = ITEM_WIDTH / 2
const SLOT_STEP = 170 // item width + the queue's resting gap

// The only two hardcoded coordinates in the carousel. Point 0 is 108px in
// from the left edge (also 108px = half of the 216px panel height, so it
// lands dead center vertically too). The waiting point sits at the exact
// horizontal middle of the bar. Every other queued avatar is positioned
// purely as a formula off the waiting point — nothing is ever repositioned
// because of bubble state, only because its index in the queue changed.
const POINT_ZERO_CENTER = 108
const POINT_ZERO_LEFT = POINT_ZERO_CENTER - ITEM_HALF
const BUBBLE_LEFT = POINT_ZERO_LEFT + ITEM_WIDTH

// Nudge the waiting point left/right from the bar's exact horizontal
// center (0 = dead center). Every slot beyond it (next-next, etc.) is
// still spaced off this value by SLOT_STEP.
const WAITING_POINT_OFFSET = - 250

function visibleWindow(students: Student[], start: number, size: number): Student[] {
  const count = Math.min(size, students.length)
  return Array.from({ length: count }, (_, offset) => students[(start + offset) % students.length])
}

function leftForPosition(position: number): string {
  if (position === 0) {
    return `${POINT_ZERO_LEFT}px`
  }
  const offset = WAITING_POINT_OFFSET + (position - 1) * SLOT_STEP
  return `calc(50% - ${ITEM_HALF}px + ${offset}px)`
}

export function StoriesPanel() {
  const { activeIndex, bubbleOpen } = useStoryCycle(mockStudents.length)
  const activeStudent = mockStudents[activeIndex]
  const visibleStudents = visibleWindow(mockStudents, activeIndex, WINDOW_SIZE)

  return (
    <section className="panel glass-panel panel-float stories-panel">
      <p className="eyebrow eyebrow-on-light stories-eyebrow">Stories</p>
      <div className="stories-row">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleStudents.map((student, position) => (
            <motion.div
              layout
              key={student.id}
              className={`story-item${position === 0 ? ' is-active' : ''}`}
              style={{ left: leftForPosition(position) }}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            >
              <Avatar
                name={student.name}
                initials={student.initials}
                colorFrom={student.colorFrom}
                colorTo={student.colorTo}
                size={110}
              />
              <span className="story-name">{student.name.split(' ')[0]}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="story-bubble-slot" style={{ left: `${BUBBLE_LEFT}px` }}>
          <AnimatePresence>{bubbleOpen && <SpeechBubble key={activeStudent.id} student={activeStudent} />}</AnimatePresence>
        </div>
      </div>
    </section>
  )
}
