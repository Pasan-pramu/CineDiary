import {
  Archive,
  CheckCircle2,
  Clapperboard,
  FolderOpen,
  ImagePlus,
  Info,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Smile,
  Sun,
  TriangleAlert,
  UserRound
} from 'lucide-react'
import { useEffect, useState } from 'react'
import tmdbLogo from '../assets/tmdb-logo.svg'
import PageTitle from '../components/PageTitle'
import BackupSection from '../components/BackupSection'
import MoodsSection from '../components/MoodsSection'
import SectionPanel from '../components/SectionPanel'
import HeroBanner from '../components/dashboard/HeroBanner'
import { setSettings, useSettings } from '../hooks/useSettings'
import { SHORTCUTS } from '../../../shared/shortcuts'
import type { AppearanceMode } from '../../../shared/theme'
import type {
  AppInfo,
  BackupOutcome,
  AppSettings,
  TmdbResult,
  TmdbSyncProgress,
  TmdbTokenStatus
} from '../../../shared/types'
import { tmdbTokenSchema } from '../../../shared/validation'
import { failed, quietly, showToast } from '../errors'

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'moods', label: 'Moods & reasons', icon: Smile },
  { id: 'tmdb', label: 'TMDB', icon: Clapperboard },
  { id: 'backup', label: 'Backup & Export', icon: Archive },
  { id: 'about', label: 'About', icon: Info }
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function Settings(): React.JSX.Element {
  const settings = useSettings()
  const [current, setCurrent] = useState<SectionId>('profile')

  // Highlights the section you're reading: the last one whose top has scrolled past the bar.
  useEffect(() => {
    if (!settings) return
    const update = (): void => {
      let next: SectionId = 'profile'
      for (const section of SECTIONS) {
        const element = document.getElementById(`settings-${section.id}`)
        if (element && element.getBoundingClientRect().top <= 140) next = section.id
      }
      // At the very bottom, the last section counts even if it's short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4)
        next = 'about'
      setCurrent(next)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [settings])

  const jump = (id: SectionId): void => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document
      .getElementById(`settings-${id}`)
      ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="page-reading">
      <PageTitle description="Your local preferences. Everything stays on this computer.">
        Settings
      </PageTitle>
      {settings ? (
        <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
          <nav aria-label="Settings sections" className="mb-6 lg:mb-0">
            <ul className="flex flex-wrap gap-1 lg:sticky lg:top-28 lg:flex-col">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => jump(section.id)}
                    aria-current={current === section.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition ${
                      current === section.id
                        ? 'bg-[var(--color-accent-muted)] font-semibold text-[var(--color-accent-light)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-panel)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <section.icon size={16} />
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0 space-y-6">
            <div id="settings-profile" className="scroll-mt-28">
              <SectionPanel title="Profile">
                <div className="space-y-8">
                  {/* Remounts when the saved name changes, so the field starts from it. */}
                  <DisplayNameSection
                    key={settings.displayName ?? ''}
                    saved={settings.displayName}
                  />
                  <BannerSection settings={settings} />
                </div>
              </SectionPanel>
            </div>
            <div id="settings-appearance" className="scroll-mt-28">
              <AppearanceSection mode={settings.appearance} />
            </div>
            <div id="settings-moods" className="scroll-mt-28">
              <MoodsSection />
            </div>
            <div id="settings-tmdb" className="scroll-mt-28">
              <TmdbSection
                token={settings.tmdbToken}
                backgroundSync={settings.tmdbBackgroundSync}
              />
            </div>
            <div id="settings-backup" className="scroll-mt-28">
              <BackupSection />
            </div>
            <div id="settings-about" className="scroll-mt-28">
              <AboutSection />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** A titled part inside a settings panel. */
function Subsection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {children}
    </div>
  )
}

const APPEARANCE_OPTIONS: Array<{
  mode: AppearanceMode
  label: string
  icon: typeof Sun
  hint: string
}> = [
  { mode: 'system', label: 'System', icon: Monitor, hint: 'Follows Windows' },
  { mode: 'light', label: 'Light', icon: Sun, hint: 'Bright and airy' },
  { mode: 'dark', label: 'Dark', icon: Moon, hint: 'Easy on the eyes' }
]

/** Dark / Light / System. The page and Windows' title bar switch at once. */
function AppearanceSection({ mode }: { mode: AppearanceMode }): React.JSX.Element {
  return (
    <SectionPanel title="Appearance">
      <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
        {APPEARANCE_OPTIONS.map((option) => {
          const active = option.mode === mode
          return (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => void window.api.settings.setAppearance(option.mode).then(setSettings)}
              className={`flex items-center gap-3 rounded-[var(--radius-card)] border p-4 text-left transition ${
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-panel-elevated)]'
              }`}
            >
              <span
                className={`flex size-10 items-center justify-center rounded-[var(--radius-control)] ${
                  active
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'bg-[var(--color-panel-elevated)] text-[var(--color-text-secondary)]'
                }`}
              >
                <option.icon size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                  {option.label}
                </span>
                <span className="block text-xs text-[var(--color-text-muted)]">{option.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </SectionPanel>
  )
}

function DisplayNameSection({ saved }: { saved: string | null }): React.JSX.Element {
  const [name, setName] = useState(saved ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const changed = name.trim() !== (saved ?? '')

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    setStatus('saving')
    void window.api.settings
      .setDisplayName(name)
      .then((next) => {
        setSettings(next)
        setStatus('saved')
      })
      .catch(() => setStatus('error'))
  }

  return (
    <Subsection title="Display name">
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Used for your greeting on Home, e.g. “Good evening, {name.trim() || 'friend'}”.
        </p>
        <div className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setStatus('idle')
            }}
            maxLength={60}
            placeholder="Your name"
            aria-label="Display name"
            className="field min-w-56 flex-1"
          />
          <button
            type="submit"
            disabled={!changed || status === 'saving'}
            className="btn btn-primary"
          >
            Save
          </button>
        </div>
        {status === 'saved' ? (
          <p className="text-xs text-[var(--color-positive)]">Saved.</p>
        ) : status === 'error' ? (
          <p className="text-xs text-[var(--color-danger)]">Couldn’t save your name. Try again.</p>
        ) : null}
      </form>
    </Subsection>
  )
}

function BannerSection({ settings }: { settings: AppSettings }): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = (action: () => Promise<AppSettings>): void => {
    setBusy(true)
    setError(null)
    void action()
      .then(setSettings)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Something went wrong.')
      )
      .finally(() => setBusy(false))
  }

  return (
    <Subsection title="Home banner">
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        The image behind your greeting on Home. Pick your own, or keep the built-in sunset.
      </p>
      <HeroBanner
        greeting="Good evening"
        subtitle="This is how your Home banner will look."
        bannerFile={settings.bannerFile}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => window.api.settings.pickBanner())}
          className="btn btn-primary"
        >
          <ImagePlus size={16} /> Choose image…
        </button>
        {settings.bannerFile ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => window.api.settings.removeBanner())}
            className="btn btn-secondary"
          >
            <RotateCcw size={16} /> Use the built-in design
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p> : null}
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        JPG, PNG or WebP. A wide image (about 3:1) works best; it’s copied into CineDiary’s own
        folder.
      </p>
    </Subsection>
  )
}

type TestState =
  { status: 'idle' } | { status: 'testing' } | { status: 'done'; result: TmdbResult<true> }

function TestResult({ state }: { state: TestState }): React.JSX.Element | null {
  if (state.status === 'idle') return null
  if (state.status === 'testing') {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> Testing the
        connection…
      </p>
    )
  }
  return state.result.ok ? (
    <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-positive)]">
      <CheckCircle2 size={14} /> Connected to TMDB. Search is ready in Add Title.
    </p>
  ) : (
    <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-danger)]">
      <TriangleAlert size={14} /> {state.result.error.message}
    </p>
  )
}

/** TMDB API token: encrypted in main, shown here only as a masked hint. */
function TmdbSection({
  token,
  backgroundSync
}: {
  token: TmdbTokenStatus
  backgroundSync: boolean
}): React.JSX.Element {
  const [replacing, setReplacing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const editing = token.state !== 'saved' || replacing

  const runTest = (): void => {
    setTest({ status: 'testing' })
    void window.api.tmdb.testConnection().then((result) => setTest({ status: 'done', result }))
  }

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    const parsed = tmdbTokenSchema.safeParse(value)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'That doesn’t look like a token.')
      return
    }
    setSaving(true)
    setError(null)
    void window.api.settings
      .setTmdbToken(parsed.data)
      .then((next) => {
        setSettings(next)
        setValue('')
        setReplacing(false)
        runTest()
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'The token couldn’t be saved.')
      )
      .finally(() => setSaving(false))
  }

  const remove = (): void => {
    if (!window.confirm('Remove your TMDB token? TMDB search will be turned off.')) return
    setTest({ status: 'idle' })
    void window.api.settings.removeTmdbToken().then(setSettings)
  }

  return (
    <SectionPanel title="TMDB">
      <p className="mb-4 text-sm leading-6 text-[var(--color-text-muted)]">
        Connect TMDB to search movies and series in Add Title and fill in details and posters
        automatically. Your token is encrypted and stays on this computer.
      </p>
      {token.state === 'unreadable' && !replacing ? (
        <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-[var(--color-rating)]/10 px-4 py-3 text-sm text-[var(--color-rating)]">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          Your saved token can’t be read on this computer (for example after restoring a backup).
          Please enter it again.
        </p>
      ) : null}
      {editing ? (
        <form onSubmit={save}>
          <div className="flex flex-wrap gap-3">
            <input
              type="password"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setError(null)
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste your API Read Access Token"
              aria-label="TMDB API Read Access Token"
              className="field min-w-56 flex-1"
            />
            <button type="submit" disabled={!value.trim() || saving} className="btn btn-primary">
              <KeyRound size={16} /> Save token
            </button>
            {replacing ? (
              <button
                type="button"
                onClick={() => setReplacing(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {error ? <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p> : null}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 min-w-56 flex-1 items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 font-mono text-sm tracking-wider text-[var(--color-text-secondary)]">
            ••••••••••••{token.hint}
          </span>
          <button
            type="button"
            onClick={runTest}
            disabled={test.status === 'testing'}
            className="btn btn-primary"
          >
            Test connection
          </button>
          <button
            type="button"
            onClick={() => {
              setReplacing(true)
              setTest({ status: 'idle' })
            }}
            className="btn btn-secondary"
          >
            Replace
          </button>
          <button type="button" onClick={remove} className="btn btn-secondary">
            Remove
          </button>
        </div>
      )}
      <TestResult state={test} />
      {token.state === 'saved' ? <TmdbSyncControls backgroundSync={backgroundSync} /> : null}
      <details className="mt-5 text-sm text-[var(--color-text-muted)]">
        <summary className="cursor-pointer font-semibold text-[var(--color-text-secondary)]">
          How do I get a token?
        </summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 leading-6">
          <li>Create a free account on themoviedb.org.</li>
          <li>Open your account Settings → API and request an API key (personal use).</li>
          <li>
            Copy the <strong>API Read Access Token</strong> (the long one, not the short API key)
            and paste it above.
          </li>
        </ol>
      </details>
    </SectionPanel>
  )
}

/** Background sync toggle and "Refresh all TMDB data now" with progress. */
function TmdbSyncControls({ backgroundSync }: { backgroundSync: boolean }): React.JSX.Element {
  const [progress, setProgress] = useState<TmdbSyncProgress | null>(null)

  useEffect(() => {
    void window.api.tmdb.syncProgress().then(setProgress).catch(quietly('tmdb:syncProgress'))
    return window.api.tmdb.onSyncProgress(setProgress)
  }, [])

  const toggle = (): void => {
    void window.api.settings.setTmdbBackgroundSync(!backgroundSync).then(setSettings)
  }

  const percent = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="mt-6 space-y-5 border-t border-[var(--color-border)] pt-5">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Background sync</p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
            Quietly refreshes TMDB details every few months while CineDiary is open. Your own edits
            and personal data (status, rating, favorites, watch memories) are never changed.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={backgroundSync}
          aria-label="Background sync"
          onClick={toggle}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
            backgroundSync ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-panel-elevated)]'
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-[var(--color-on-accent)] shadow transition-all ${
              backgroundSync ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <div>
        {progress?.running ? (
          <div>
            <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
              Refreshing {progress.done} of {progress.total}…
              <button
                type="button"
                onClick={() => void window.api.tmdb.cancelRefresh()}
                className={`btn btn-secondary ml-auto`}
              >
                Cancel
              </button>
            </div>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Refresh progress"
              className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-panel-elevated)]"
            >
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void window.api.tmdb.refreshAll().then(setProgress)}
              className="btn btn-secondary"
            >
              <RotateCcw size={16} /> Refresh all TMDB data now
            </button>
            {progress && progress.total > 0 && progress.stoppedReason === null ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-positive)]">
                <CheckCircle2 size={14} /> Refreshed {progress.done} of {progress.total} titles.
              </p>
            ) : null}
            {progress?.stoppedReason === 'cancelled' ? (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                Cancelled after {progress.done} of {progress.total} titles.
              </p>
            ) : null}
            {progress?.stoppedReason === 'error' ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-danger)]">
                <TriangleAlert size={14} />
                {progress.total > 0 ? `Stopped after ${progress.done} of ${progress.total}. ` : ''}
                {progress.message} It will try again later.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/** Opens a folder; says so when the system couldn't. */
async function openFolder(opening: Promise<BackupOutcome>): Promise<void> {
  const result = await opening.catch(() => null)
  if (!result?.ok) showToast(result?.message ?? 'Couldn’t open the folder.')
}

function AboutSection(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.api.app.info().then(setInfo).catch(failed('Couldn’t load the app details.'))
  }, [])

  return (
    <SectionPanel title="About">
      <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
        CineDiary — a private, local-first diary for every movie and series you watch. All your data
        stays on this computer.
      </p>
      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
        <dt className="text-[var(--color-text-muted)]">Version</dt>
        <dd className="text-[var(--color-text-primary)]">{info?.version ?? '–'}</dd>
        <dt className="text-[var(--color-text-muted)]">Data folder</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-3">
          <code className="min-w-0 break-all text-xs text-[var(--color-text-secondary)]">
            {info?.dataFolder ?? '–'}
          </code>
          <button
            type="button"
            onClick={() => void openFolder(window.api.backup.openDataFolder())}
            className="link"
          >
            <FolderOpen size={14} /> Open
          </button>
        </dd>
        <dt className="text-[var(--color-text-muted)]">Error log</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="text-xs text-[var(--color-text-secondary)]">
            logs/cinediary.log: errors only (what failed and where), never your diary text
          </span>
          <button
            type="button"
            onClick={() => void openFolder(window.api.app.openLogs())}
            className="link"
          >
            <FolderOpen size={14} /> Open
          </button>
        </dd>
      </dl>
      <h3 className="mt-6 text-sm font-semibold text-[var(--color-text-primary)]">
        Keyboard shortcuts
      </h3>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {SHORTCUTS.map((shortcut) => (
            <tr key={shortcut.keys} className="border-t border-[var(--color-border)]">
              <td className="w-40 py-2 pr-4 align-top">
                <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel-elevated)] px-1.5 py-0.5 text-xs text-[var(--color-text-primary)]">
                  {shortcut.keys}
                </kbd>
              </td>
              <td className="py-2 text-[var(--color-text-secondary)]">{shortcut.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        Shortcuts other than Esc, Ctrl+K and Ctrl+N wait until you leave a text field. On a Mac, use
        Cmd instead of Ctrl.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[var(--color-border)] pt-5">
        {/* The logo's light gradient needs a dark surface in light mode (token). */}
        <span
          className="rounded-md px-2.5 py-2"
          style={{ background: 'var(--color-logo-surface)' }}
        >
          <img src={tmdbLogo} alt="The Movie Database (TMDB)" className="h-4 w-auto" />
        </span>
        <p className="text-xs leading-5 text-[var(--color-text-muted)]">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </div>
    </SectionPanel>
  )
}

export default Settings
