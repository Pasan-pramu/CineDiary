import { useEffect, useRef } from 'react'

/** Calls `onEscape` when Esc is pressed (dialogs close this way). */
export function useEscape(onEscape: () => void, enabled = true): void {
  const callback = useRef(onEscape)
  useEffect(() => {
    callback.current = onEscape
  })
  useEffect(() => {
    if (!enabled) return
    const handle = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      callback.current()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [enabled])
}
