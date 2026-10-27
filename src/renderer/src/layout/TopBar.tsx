import { Bell, Moon, Search } from 'lucide-react'
import OnlineBadge from '../components/OnlineBadge'
import UserAvatar from '../components/UserAvatar'
import { useSettings } from '../hooks/useSettings'

function TopBar(): React.JSX.Element {
  const settings = useSettings()
  return (
    <header className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/90 px-5 backdrop-blur sm:px-8 lg:px-10">
      <div className="relative max-w-2xl flex-1">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="search"
          placeholder="Search movies, series, genres, or anything..."
          className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
        />
      </div>
      <OnlineBadge />
      <button
        type="button"
        aria-label="Toggle theme"
        className="hidden size-10 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-panel)] hover:text-white sm:flex"
      >
        <Moon size={18} />
      </button>
      <button
        type="button"
        aria-label="Notifications"
        className="hidden size-10 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-panel)] hover:text-white sm:flex"
      >
        <Bell size={18} />
      </button>
      <UserAvatar name={settings?.displayName} className="size-10" />
    </header>
  )
}

export default TopBar
