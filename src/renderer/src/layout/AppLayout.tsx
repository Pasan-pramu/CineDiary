import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'
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
  // A new page starts at the top (filters changing the query string keep the scroll).
  const { pathname } = useLocation()
  // (Braces matter: scrollTo returns a Promise in newer Chromium, and an effect may only return a cleanup.)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
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
          {/* Keyed by page, so each new page fades in (DESIGN.md: 150–250ms). */}
          <div key={pathname} className="page-enter">
            {/* A crashing page shows "Something went wrong"; the sidebar keeps working. */}
            <ErrorBoundary resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
