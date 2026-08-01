import { useEffect, useState } from 'react'

export function useCarousel(slideCount: number, intervalMs = 6000) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slideCount <= 1) {
      return
    }
    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount)
    }, intervalMs)
    return () => window.clearInterval(intervalId)
  }, [slideCount, intervalMs])

  return { index, setIndex }
}
