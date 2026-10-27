import { ImagePlus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import PageTitle from '../components/PageTitle'
import SectionPanel from '../components/SectionPanel'
import HeroBanner from '../components/dashboard/HeroBanner'
import { setSettings, useSettings } from '../hooks/useSettings'
import type { AppSettings } from '../../../shared/types'

const primaryButton =
  'inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-light)] disabled:opacity-50'
const secondaryButton =
  'inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-panel-elevated)] hover:text-white disabled:opacity-50'

function Settings(): React.JSX.Element {
  const settings = useSettings()
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle description="Your local preferences. Everything stays on this computer.">
        Settings
      </PageTitle>
      {settings ? (
        <div className="space-y-6">
          {/* Remounts when the saved name changes, so the field starts from it. */}
          <DisplayNameSection key={settings.displayName ?? ''} saved={settings.displayName} />
          <BannerSection settings={settings} />
        </div>
      ) : null}
    </div>
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
    <SectionPanel title="Display name">
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
            className="h-11 min-w-56 flex-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-white outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            disabled={!changed || status === 'saving'}
            className={primaryButton}
          >
            Save
          </button>
        </div>
        {status === 'saved' ? (
          <p className="text-xs text-[var(--color-positive)]">Saved.</p>
        ) : status === 'error' ? (
          <p className="text-xs text-[var(--color-favorite)]">
            Couldn’t save your name. Try again.
          </p>
        ) : null}
      </form>
    </SectionPanel>
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
    <SectionPanel title="Home banner">
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
          className={primaryButton}
        >
          <ImagePlus size={16} /> Choose image…
        </button>
        {settings.bannerFile ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => window.api.settings.removeBanner())}
            className={secondaryButton}
          >
            <RotateCcw size={16} /> Use the built-in design
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-xs text-[var(--color-favorite)]">{error}</p> : null}
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        JPG, PNG or WebP. A wide image (about 3:1) works best; it’s copied into CineDiary’s own
        folder.
      </p>
    </SectionPanel>
  )
}

export default Settings
