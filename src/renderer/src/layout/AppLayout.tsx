import { useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import QuickAddProvider from '../components/QuickAddProvider'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { useShortcuts } from '../hooks/useShortcuts'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

function AppLayout(): React.JSX.Element {
  return (
    <QuickAddProvider>
      <Shell />
    </QuickAddProvider>
  )
}

function Shell(): React.JSX.Element {
  const navigate = useNavigate()
  const quickAdd = useQuickAdd()
  const searchRef = useRef<HTMLInputElement>(null)
  useShortcuts({
    focusSearch: () => {
      searchRef.current?.focus()
      searchRef.current?.select()
    },
    quickAdd,
    navigate: (path) => void navigate(path)
  })

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <Sidebar />
      <div className="min-h-screen lg:pl-64">
        <TopBar searchRef={searchRef} />
        <main className="px-5 pb-10 pt-5 sm:px-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
