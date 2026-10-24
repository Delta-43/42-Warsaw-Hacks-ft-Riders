import { useEffect, useState } from 'react'
import { usePlaybackPaused } from '../playback'

// `forcedIndex` lets the demo tour pin a slide; while it is set the carousel
// does not auto-advance. Auto-advance also stops while playback is paused.
export function useCarousel(slideCount: number, intervalMs = 6000, forcedIndex?: number) {
  const [index, setIndex] = useState(0)
  const paused = usePlaybackPaused()
  const forced = forcedIndex !== undefined

  useEffect(() => {
    if (slideCount <= 1 || paused || forced) {
      return
    }
    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount)
    }, intervalMs)
    return () => window.clearInterval(intervalId)
  }, [slideCount, intervalMs, paused, forced])

  const current = forced ? Math.min(forcedIndex, slideCount - 1) : Math.min(index, slideCount - 1)
  return { index: current, setIndex }
}
