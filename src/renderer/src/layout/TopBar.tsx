import { Moon, Sun } from 'lucide-react'
import OnlineBadge from '../components/OnlineBadge'
import UserAvatar from '../components/UserAvatar'
import { useResolvedTheme } from '../hooks/useResolvedTheme'
import { setSettings, useSettings } from '../hooks/useSettings'
import GlobalSearch from './GlobalSearch'

function TopBar({
  searchRef
}: {
  searchRef: React.RefObject<HTMLInputElement | null>
}): React.JSX.Element {
  const settings = useSettings()
  const theme = useResolvedTheme()
  // Quick switch between light and dark (Settings → Appearance also offers "System").
  const toggleTheme = (): void => {
    void window.api.settings.setAppearance(theme === 'dark' ? 'light' : 'dark').then(setSettings)
  }
  return (
    <header className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/90 px-5 backdrop-blur sm:px-8 lg:px-10">
      <GlobalSearch inputRef={searchRef} />
      <OnlineBadge />
      <button
        type="button"
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={toggleTheme}
        className="btn btn-ghost btn-icon hidden border-[var(--color-border)] sm:inline-flex"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <UserAvatar name={settings?.displayName} className="size-10" />
    </header>
  )
}

export default TopBar
