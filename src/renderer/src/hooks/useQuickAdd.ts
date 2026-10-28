import { createContext, useContext } from 'react'

// One Quick Add dialog for the whole app (components/QuickAddProvider.tsx): the sidebar, the
// dashboard hero and Ctrl+N open it.

export const QuickAddContext = createContext<() => void>(() => undefined)

/** Opens the Quick Add dialog. */
export function useQuickAdd(): () => void {
  return useContext(QuickAddContext)
}
