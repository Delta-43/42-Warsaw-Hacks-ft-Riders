import { motion } from 'framer-motion'
import type { StoryEvent } from './storyEvents'
import styles from './speech_bubbles.module.css'

type SpeechBubbleProps = {
  event: StoryEvent
}

// Horizontal motion only — no y offsets, so the bubble never drifts off the
// panel's vertical center line. It arrives sliding in from the right and
// leaves continuing that same leftward direction, rather than fading in place.
const bubbleVariants = {
  hidden: { opacity: 0, scale: 0.88, x: 26 },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24, mass: 0.7 },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    x: -56,
    transition: { duration: 0.3, ease: 'easeIn' as const },
  },
}

const textVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, delay: 0.2, ease: 'easeOut' as const } },
}

export function SpeechBubble({ event }: SpeechBubbleProps) {
  return (
    <motion.div
      className={styles.speechBubble}
      style={{ transformOrigin: 'left center' }}
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.p
        className={`${styles.speechBubbleLine} ${styles.speechBubbleMeta}`}
        variants={textVariants}
        initial="hidden"
        animate="visible"
      >
        {event.name}
      </motion.p>
      <motion.p
        className={`${styles.speechBubbleLine} ${styles.speechBubbleProject}`}
        variants={textVariants}
        initial="hidden"
        animate="visible"
      >
        {event.kind === 'project_pass' ? (
          <>
            Recently completed <strong>{event.projectName}</strong>
          </>
        ) : (
          <>
            <strong>{event.hoursLogged?.toFixed(1)}h</strong> logged this week
          </>
        )}
      </motion.p>
      <span className={styles.speechBubbleTail} />
    </motion.div>
  )
}
