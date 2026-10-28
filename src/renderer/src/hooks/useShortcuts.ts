import { useEffect, useRef } from 'react'
import { NAV_ITEMS } from '../../../shared/constants'

// App-wide shortcuts (the list lives in src/shared/shortcuts.ts). While typing in a field only
// Ctrl+K and Ctrl+N work; while a dialog is open none do (Esc is the dialog's own).

interface ShortcutActions {
  focusSearch: () => void
  quickAdd: () => void
  navigate: (path: string) => void
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement &&
      !['checkbox', 'radio', 'button', 'submit', 'range', 'color'].includes(target.type))
  )
}

export function useShortcuts(actions: ShortcutActions): void {
  const current = useRef(actions)
  useEffect(() => {
    current.current = actions
  })

  useEffect(() => {
    const handle = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      const key = event.key.toLowerCase()
      const run = (action: () => void): void => {
        event.preventDefault()
        action()
      }
      if (key === 'k') return run(current.current.focusSearch)
      if (key === 'n') return run(current.current.quickAdd)
      if (isTyping(event.target)) return
      const page = NAV_ITEMS[Number(key) - 1]
      if (/^[1-6]$/.test(key) && page) return run(() => current.current.navigate(page.path))
      if (key === ',') return run(() => current.current.navigate('/settings'))
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
}
