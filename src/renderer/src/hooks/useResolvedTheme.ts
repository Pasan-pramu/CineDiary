import { useSyncExternalStore } from 'react'
import type { ResolvedTheme } from '../../../shared/theme'

// The theme currently shown ("light" | "dark"). The preload keeps <html data-theme> up to date;
// this just lets components re-render when it changes.

function subscribe(onChange: () => void): () => void {
  return window.api.theme.onChange(() => onChange())
}

function snapshot(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, snapshot)
}
