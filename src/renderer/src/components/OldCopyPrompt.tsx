import { useEffect, useState } from 'react'
import type { DataLocationStatus } from '../../../shared/types'
import { quietly, showToast, userMessage } from '../errors'
import Dialog from './Dialog'

/**
 * After a move: "Your data now lives in … Delete the old copy?" Asked once at startup; "Keep for
 * now" leaves it, and Settings → About still offers to delete it.
 */
function OldCopyPrompt(): React.JSX.Element | null {
  const [status, setStatus] = useState<DataLocationStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.dataLocation.status().then(setStatus).catch(quietly('dataLocation:status'))
  }, [])

  if (!status?.previous || status.previousAnswered) return null
  const previous = status.previous

  return (
    <Dialog
      onClose={() => {
        void window.api.dataLocation.keepOld().catch(quietly('dataLocation:keepOld'))
        setStatus(null)
      }}
      labelledBy="old-copy-title"
      className="max-w-lg"
      locked={busy}
    >
      {(close) => (
        <div className="overflow-y-auto p-6">
          <h2
            id="old-copy-title"
            className="font-display text-2xl text-[var(--color-text-primary)]"
          >
            Your data has moved
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            CineDiary now uses{' '}
            <code className="break-all text-[var(--color-text-primary)]">{status.folder}</code>. The
            old copy is still in{' '}
            <code className="break-all text-[var(--color-text-primary)]">{previous}</code>.
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
            Deleting removes only CineDiary’s files there (database, posters, backdrops, banners,
            safety backups and logs), nothing else.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={close} disabled={busy} className="btn btn-secondary">
              Keep for now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void window.api.dataLocation
                  .deleteOld()
                  .then((result) => {
                    if (result.ok) showToast('The old copy was deleted.', 'success')
                    else showToast(result.message)
                  })
                  .catch((error: unknown) => showToast(userMessage(error)))
                  .finally(() => {
                    setBusy(false)
                    setStatus(null)
                  })
              }}
              className="btn btn-danger"
            >
              Delete the old copy
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

export default OldCopyPrompt
