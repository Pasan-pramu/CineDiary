// Keyboard shortcuts, listed once: handled in renderer/src/hooks/useShortcuts.ts and shown in
// Settings → About. "Ctrl" is Cmd on a Mac.

export const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Ctrl+K', action: 'Search everything' },
  { keys: 'Ctrl+N', action: 'Quick add a title' },
  { keys: 'Ctrl+1 … Ctrl+6', action: 'Home, Collection, Journal, Insights, Discover, Timeline' },
  { keys: 'Ctrl+,', action: 'Settings' },
  { keys: 'Esc', action: 'Close a dialog or the search results' }
]
