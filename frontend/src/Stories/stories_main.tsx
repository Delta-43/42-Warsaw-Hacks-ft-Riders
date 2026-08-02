import { AnimatePresence, motion } from 'framer-motion'
import { Avatar } from '../Global/Avatars/Avatar'
import { SpeechBubble } from './SpeechBubble'
import type { StoryEvent } from './storyEvents'
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
const WAITING_POINT_OFFSET = -250

function visibleWindow(events: StoryEvent[], start: number, size: number): StoryEvent[] {
  const count = Math.min(size, events.length)
  return Array.from({ length: count }, (_, offset) => events[(start + offset) % events.length])
}

function leftForPosition(position: number): string {
  if (position === 0) {
    return `${POINT_ZERO_LEFT}px`
  }
  const offset = WAITING_POINT_OFFSET + (position - 1) * SLOT_STEP
  return `calc(50% - ${ITEM_HALF}px + ${offset}px)`
}

type StoriesPanelProps = {
  events: StoryEvent[]
}

export function StoriesPanel({ events }: StoriesPanelProps) {
  const { activeIndex, bubbleOpen } = useStoryCycle(events.length)

  if (events.length === 0) {
    return (
      <section className="panel glass-panel panel-float stories-panel">
        <p className="eyebrow eyebrow-on-light stories-eyebrow">Stories</p>
        <p className="stories-empty">No recent campus activity yet</p>
      </section>
    )
  }

  const activeEvent = events[activeIndex]
  const visibleEvents = visibleWindow(events, activeIndex, WINDOW_SIZE)

  return (
    <section className="panel glass-panel panel-float stories-panel">
      <p className="eyebrow eyebrow-on-light stories-eyebrow">Stories</p>
      <div className="stories-row">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleEvents.map((event, position) => (
            <motion.div
              layout
              key={event.id}
              className={`story-item${position === 0 ? ' is-active' : ''}`}
              style={{ left: leftForPosition(position) }}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            >
              <Avatar
                name={event.name}
                initials={event.initials}
                colorFrom={event.colorFrom}
                colorTo={event.colorTo}
                photoUrl={event.photoUrl}
                size={110}
              />
              <span className="story-name">{event.name.split(' ')[0]}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="story-bubble-slot" style={{ left: `${BUBBLE_LEFT}px` }}>
          <AnimatePresence>{bubbleOpen && <SpeechBubble key={activeEvent.id} event={activeEvent} />}</AnimatePresence>
        </div>
      </div>
    </section>
  )
}
