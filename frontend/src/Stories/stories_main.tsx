import { AnimatePresence, motion } from 'framer-motion'
import { Avatar } from '../Global/Avatars/Avatar'
import { SpeechBubble } from './SpeechBubble'
import type { StoryEvent } from './storyEvents'
import { useStoryCycle } from './useStoryCycle'
import styles from './stories_main.module.css'

const WINDOW_SIZE = 8
const ITEM_WIDTH = 150
const SLOT_STEP = 170 // item width + the queue's resting gap

// Every position — the active avatar, the bubble, and the whole queue — is
// placed on ONE coordinate system: a fixed pixel offset from the row's own
// left edge. (Previously position 0 + the bubble were fixed px while the
// queue was positioned with `calc(50% - ...)`, i.e. relative to the panel's
// width. Those two systems only lined up at whatever width the row happened
// to be authored at — resize the window and the queue would drift left/right
// while the active avatar and bubble stayed put, overlapping. Pure fixed-px
// throughout means every element's position relative to every other element
// never changes, at any width — the row's own `overflow: hidden` + right-edge
// fade mask is what handles a narrower viewport, not the coordinate math.)
const POINT_ZERO_LEFT = 33
const BUBBLE_LEFT = POINT_ZERO_LEFT + ITEM_WIDTH

// Where the queue starts, fixed px from the row's left edge. Comfortably
// clear of the widest realistic speech-bubble content (bubble text is
// `white-space: nowrap`, so its rendered width varies with project-name
// length) — if bubble copy ever gets much longer, increase this.
const WAITING_POINT_LEFT = 520

function visibleWindow(events: StoryEvent[], start: number, size: number): StoryEvent[] {
  const count = Math.min(size, events.length)
  return Array.from({ length: count }, (_, offset) => events[(start + offset) % events.length])
}

function leftForPosition(position: number): string {
  if (position === 0) {
    return `${POINT_ZERO_LEFT}px`
  }
  return `${WAITING_POINT_LEFT + (position - 1) * SLOT_STEP}px`
}

// Visual priority order: active avatar, then the speech bubble (styled in
// SpeechBubble/speech_bubbles.module.css), then the next-up avatar, then
// everything still queued. Position 0 is the active avatar; position 1 sits
// right after the bubble and reads as the "third" element in that order.
// Every avatar is the same size — only the active one gets a slight bump,
// not a size cascade down the queue.
const AVATAR_SIZE = 100
const ACTIVE_AVATAR_SIZE = 114

function sizeForPosition(position: number): number {
  return position === 0 ? ACTIVE_AVATAR_SIZE : AVATAR_SIZE
}

function tierClassName(position: number): string {
  if (position === 0) {
    return styles.isActive
  }
  if (position === 1) {
    return styles.isNext
  }
  return styles.isQueued
}

type StoriesPanelProps = {
  events: StoryEvent[]
}

export function StoriesPanel({ events }: StoriesPanelProps) {
  const { activeIndex, bubbleOpen } = useStoryCycle(events.length)

  if (events.length === 0) {
    return (
      <section className="panel glass-panel panel-float stories-panel">
        <p className={`eyebrow eyebrow-on-light ${styles.storiesEyebrow}`}>Stories</p>
        <p className={styles.storiesEmpty}>No recent campus activity yet</p>
      </section>
    )
  }

  const activeEvent = events[activeIndex]
  const visibleEvents = visibleWindow(events, activeIndex, WINDOW_SIZE)

  return (
    <section className="panel glass-panel panel-float stories-panel">
      <p className={`eyebrow eyebrow-on-light ${styles.storiesEyebrow}`}>Stories</p>
      <div className={styles.storiesRow}>
        <AnimatePresence initial={false} mode="popLayout">
          {visibleEvents.map((event, position) => (
            <motion.div
              layout
              key={event.id}
              className={`${styles.storyItem} ${tierClassName(position)}`}
              style={{ left: leftForPosition(position), zIndex: WINDOW_SIZE - position }}
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
                size={sizeForPosition(position)}
                className={position === 0 ? styles.activeAvatarGlow : undefined}
              />
              <span className={styles.storyName}>{event.name.split(' ')[0]}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className={styles.storyBubbleSlot} style={{ left: `${BUBBLE_LEFT}px` }}>
          <AnimatePresence>{bubbleOpen && <SpeechBubble key={activeEvent.id} event={activeEvent} />}</AnimatePresence>
        </div>
      </div>
    </section>
  )
}
