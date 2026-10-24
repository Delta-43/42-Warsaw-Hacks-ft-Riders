import { createContext, useContext } from 'react'

// One switch for everything that moves on its own (carousels, story cycle,
// the guided tour). WCAG 2.2.2: auto-updating content needs a pause control.
export const PlaybackContext = createContext({ paused: false })

export function usePlaybackPaused(): boolean {
  return useContext(PlaybackContext).paused
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
