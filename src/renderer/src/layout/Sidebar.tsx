import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Compass,
  Home,
  LibraryBig,
  Plus,
  Settings,
  Sparkles
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../../shared/constants'
import UserAvatar from '../components/UserAvatar'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { useSettings } from '../hooks/useSettings'
import { APP_NAME } from '../../../shared/app'

/** Same look for the main pages and Settings. */
function navClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-3 text-sm font-medium transition ${
    isActive
      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-lg shadow-[var(--color-accent)]/20'
      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-panel)] hover:text-[var(--color-text-primary)]'
  }`
}

const icons = {
  home: Home,
  library: LibraryBig,
  journal: BookOpen,
  statistics: BarChart3,
  discover: Compass,
  timeline: CalendarDays
} as const

function Sidebar(): React.JSX.Element {
  const settings = useSettings()
  const quickAdd = useQuickAdd()
  return (
    // Scrolls when the window is too short for everything; the tagline card hides first.
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-6 lg:flex">
      <div className="flex items-center gap-3 px-3">
        <div className="flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-lg shadow-[var(--color-accent)]/20">
          <Clapperboard size={21} strokeWidth={2.2} />
        </div>
        <div>
          <p className="font-semibold tracking-tight text-[var(--color-text-primary)]">
            {APP_NAME}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">Watch · Feel · Remember</p>
        </div>
      </div>

      <nav className="mt-10 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = icons[item.icon]
          return (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} className={navClass}>
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={quickAdd}
        title="Quick add (Ctrl+N)"
        className="btn btn-primary mt-6 w-full shadow-lg shadow-[var(--color-accent)]/20"
      >
        <Plus size={18} />
        Add Title
      </button>

      <div className="mt-auto space-y-5 pt-6">
        <div className="panel p-4 [@media(max-height:760px)]:hidden">
          <Sparkles size={18} className="mb-3 text-[var(--color-accent-light)]" />
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
            Better stories.
            <br />
            Better moods.
            <br />A better you.
          </p>
        </div>
        <NavLink to="/settings" className={navClass}>
          <Settings size={18} />
          Settings
        </NavLink>
        <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-2 pt-5">
          <UserAvatar name={settings?.displayName} className="size-9 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm text-[var(--color-text-primary)]">
              {settings?.displayName || 'Your diary'}
            </p>
            <p className="truncate text-xs text-[var(--color-text-muted)]">Personal dashboard</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
