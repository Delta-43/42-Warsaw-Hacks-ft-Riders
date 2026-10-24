import { useEffect, useState } from 'react'
import { usePlaybackPaused } from '../Global/playback'

const ARRIVAL_DELAY_MS = 250
const BUBBLE_HOLD_MS = 6000
const BUBBLE_EXIT_MS = 350
const SLIDE_SETTLE_MS = 500

// `resetKey` restarts the cycle from the first story (the demo uses it so a
// freshly scripted win is the one that gets announced).
export function useStoryCycle(count: number, resetKey = '') {
  const [activeIndex, setActiveIndex] = useState(0)
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const paused = usePlaybackPaused()

  useEffect(() => {
    setActiveIndex(0)
  }, [resetKey])

  useEffect(() => {
    if (count === 0) {
      return
    }
    if (paused) {
      // Hold on the current story with its bubble showing.
      setBubbleOpen(true)
      return
    }

    let cancelled = false
    const timeouts: number[] = []

    const after = (fn: () => void, delay: number) => {
      const id = window.setTimeout(() => {
        if (!cancelled) {
          fn()
        }
      }, delay)
      timeouts.push(id)
    }

    const runCycle = () => {
      setBubbleOpen(false)
      after(() => setBubbleOpen(true), ARRIVAL_DELAY_MS)
      after(() => setBubbleOpen(false), ARRIVAL_DELAY_MS + BUBBLE_HOLD_MS)
      after(() => {
        setActiveIndex((current) => (current + 1) % count)
        after(runCycle, SLIDE_SETTLE_MS)
      }, ARRIVAL_DELAY_MS + BUBBLE_HOLD_MS + BUBBLE_EXIT_MS)
    }

    runCycle()

    return () => {
      cancelled = true
      timeouts.forEach(window.clearTimeout)
    }
  }, [count, paused, resetKey])

  return { activeIndex, bubbleOpen }
}
