import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/** Animates from the previous value to `target`; returns `target` directly with reduced motion. */
export function useCountUp(target: number | null, durationMs = 250): number | null {
  const reducedMotion = usePrefersReducedMotion()
  const [current, setCurrent] = useState(0)
  const currentRef = useRef(0)

  useEffect(() => {
    if (target === null || reducedMotion) return
    const from = currentRef.current
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number): void => {
      const progress = Math.min((now - startedAt) / durationMs, 1)
      const eased = 1 - (1 - progress) ** 3
      currentRef.current = from + (target - from) * eased
      setCurrent(currentRef.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, reducedMotion, durationMs])

  return target === null || reducedMotion ? target : current
}
