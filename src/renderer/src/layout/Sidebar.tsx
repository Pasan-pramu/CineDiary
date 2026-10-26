import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Clock3,
  Home,
  Plus,
  Settings,
  Sparkles
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../../shared/constants'

const icons = {
  home: Home,
  library: BookOpen,
  add: Plus,
  history: Clock3,
  statistics: BarChart3
} as const

function Sidebar(): React.JSX.Element {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-6 lg:flex">
      <div className="flex items-center gap-3 px-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20">
          <Clapperboard size={21} strokeWidth={2.2} />
        </div>
        <div>
          <p className="font-semibold tracking-tight text-white">CineDiary</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">Watch · Feel · Remember</p>
        </div>
      </div>

      <nav className="mt-10 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = icons[item.icon]
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                  isActive
                    ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-panel)] hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto space-y-5">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
          <Sparkles size={18} className="mb-3 text-[var(--color-accent-light)]" />
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
            Better stories.
            <br />
            Better moods.
            <br />A better you.
          </p>
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
              isActive
                ? 'bg-[var(--color-panel)] text-white'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>
        <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-2 pt-5">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--color-accent-muted)] text-sm font-semibold text-[var(--color-accent-light)]">
            P
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-white">Your diary</p>
            <p className="truncate text-xs text-[var(--color-text-muted)]">Personal dashboard</p>
          </div>
          <CalendarDays size={16} className="ml-auto text-[var(--color-text-muted)]" />
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
