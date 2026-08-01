import { useEffect, useState } from 'react'

export function useIsMobile(breakpointPx = 760): boolean {
  const query = `(max-width: ${breakpointPx}px)`
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query)
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [query])

  return isMobile
}
