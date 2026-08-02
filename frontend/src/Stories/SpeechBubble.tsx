import { motion } from 'framer-motion'
import { formatXp, type Student } from './students.mock'

type SpeechBubbleProps = {
  student: Student
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

export function SpeechBubble({ student }: SpeechBubbleProps) {
  return (
    <motion.div
      className="speech-bubble"
      style={{ transformOrigin: 'left center' }}
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.p className="speech-bubble-line speech-bubble-meta" variants={textVariants} initial="hidden" animate="visible">
        <span>@{student.intraLogin}</span>
        <span className="speech-bubble-divider">|</span>
        <span>{formatXp(student.xp)} XP</span>
        <span className="speech-bubble-divider">|</span>
        <span>{student.wallet}$</span>
      </motion.p>
      <motion.p className="speech-bubble-line speech-bubble-project" variants={textVariants} initial="hidden" animate="visible">
        Recently completed <strong>{student.lastProject}</strong>
      </motion.p>
      <span className="speech-bubble-tail" />
    </motion.div>
  )
}
