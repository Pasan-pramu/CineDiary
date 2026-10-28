import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { QuickAddContext } from '../hooks/useQuickAdd'
import QuickAddDialog from './QuickAddDialog'

function QuickAddProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const location = useLocation()
  const here = `${location.pathname}${location.search}`
  // Each opening gets a new key (so it starts empty) and remembers the page it was opened on:
  // going to another page (Open details, More details, any link) closes it.
  const [opened, setOpened] = useState<{ key: number; page: string } | null>(null)
  if (opened !== null && opened.page !== here) setOpened(null)
  const open = opened !== null && opened.page === here

  return (
    <QuickAddContext.Provider value={() => setOpened({ key: Date.now(), page: here })}>
      {children}
      {open ? <QuickAddDialog key={opened.key} onClose={() => setOpened(null)} /> : null}
    </QuickAddContext.Provider>
  )
}

export default QuickAddProvider
