import { useEffect, useState } from 'react'

const ARRIVAL_DELAY_MS = 250
const BUBBLE_HOLD_MS = 6000
const BUBBLE_EXIT_MS = 350
const SLIDE_SETTLE_MS = 500

export function useStoryCycle(count: number) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [bubbleOpen, setBubbleOpen] = useState(false)

  useEffect(() => {
    if (count === 0) {
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
  }, [count])

  return { activeIndex, bubbleOpen }
}
