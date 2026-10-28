import { FolderSearch, HardDrive, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import type { DataStartup } from '../../../shared/types'
import { logError, userMessage } from '../errors'
import { APP_NAME } from '../../../shared/app'

/**
 * Shown instead of the app when the chosen data folder can't be found (a drive unplugged, a
 * folder renamed) or the pointer file is damaged. Nothing is opened or created until you choose.
 */
function DataFolderMissing({
  startup
}: {
  startup: Exclude<DataStartup, { state: 'ok' }>
}): React.JSX.Element {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const result = (await action()) as { ok?: boolean; canceled?: boolean; message?: string }
      if (result && result.ok === false && !result.canceled) setError(result.message ?? '')
    } catch (caught) {
      logError('renderer', caught)
      setError(userMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-6">
      <div className="panel w-full max-w-xl p-8">
        <div className="flex size-14 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-danger-surface)] text-[var(--color-danger)]">
          <HardDrive size={26} />
        </div>
        <h1 className="page-title mt-5 text-[var(--color-text-primary)]">Can’t find your diary</h1>
        {startup.state === 'missing' ? (
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            Your {APP_NAME} data lives in{' '}
            <code className="break-all text-[var(--color-text-primary)]">{startup.folder}</code>,
            but there’s no diary there right now. If it’s on a drive that isn’t plugged in, connect
            it and try again. Nothing has been changed or created.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            The note that says where your data lives (data-location.json) can’t be read. Choose your
            data folder, or go back to the default location. Nothing has been changed.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {startup.state === 'missing' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => window.api.dataLocation.retry())}
              className="btn btn-primary"
            >
              <RotateCcw size={16} /> Try again
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => window.api.dataLocation.chooseExisting())}
            className="btn btn-secondary"
          >
            <FolderSearch size={16} /> Choose folder…
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Use the default location (${startup.defaultFolder})? If no diary is there, ${APP_NAME} starts a new, empty one. Your data in the other folder isn’t touched.`
                )
              )
                void run(() => window.api.dataLocation.useDefault())
            }}
            className="btn btn-ghost"
          >
            Use default location
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p> : null}
        <p className="mt-6 text-xs leading-5 text-[var(--color-text-muted)]">
          “Choose folder…” only accepts a folder that already holds a {APP_NAME} diary (it has a
          cinediary.db file), for example if the drive now has another letter.
        </p>
      </div>
    </main>
  )
}

export default DataFolderMissing
