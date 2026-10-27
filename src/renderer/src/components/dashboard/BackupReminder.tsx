import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BackupStatus } from '../../../../shared/types'

/** A gentle nudge on Home when there's never been a backup, or the last one is over 30 days old. */
function BackupReminder(): React.JSX.Element | null {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  /** Days since the last backup (null = never), worked out when the status arrives. */
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    void window.api.backup.status().then((next) => {
      setStatus(next)
      setDays(
        next.lastBackupAt
          ? Math.floor((Date.now() - Date.parse(next.lastBackupAt)) / 86_400_000)
          : null
      )
    })
  }, [])

  if (!status?.showReminder) return null

  return (
    <section className="animate-fade-up flex flex-wrap items-center gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-4">
      <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-accent-muted)] text-[var(--color-accent-light)]">
        <ShieldCheck size={20} />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]">
        {days === null
          ? 'Your diary hasn’t been backed up yet. A backup keeps your memories safe if something happens to this computer.'
          : `Your last backup was ${days} days ago. A fresh one keeps your newest memories safe.`}
      </p>
      <Link
        to="/settings"
        className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-light)]"
      >
        Back up
      </Link>
      <button
        type="button"
        onClick={() => void window.api.backup.snoozeReminder().then(setStatus)}
        className="text-sm text-[var(--color-text-muted)] hover:text-white"
      >
        Remind me later
      </button>
    </section>
  )
}

export default BackupReminder
