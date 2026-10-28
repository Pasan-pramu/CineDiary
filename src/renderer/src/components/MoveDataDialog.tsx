import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DataMoveStep, DataMoveTarget } from '../../../shared/types'
import { logError, userMessage } from '../errors'
import Dialog from './Dialog'

const STEPS: Array<{ step: DataMoveStep; label: string }> = [
  { step: 'pausing', label: 'Pausing TMDB sync and backups' },
  { step: 'safety-backup', label: 'Making a safety backup' },
  { step: 'copying-database', label: 'Copying the database' },
  { step: 'copying-images', label: 'Copying posters, banners, backups and logs' },
  { step: 'verifying', label: 'Checking the copy' },
  { step: 'restarting', label: 'Switching and restarting' }
]

/**
 * "Change data folder…": confirm, then the move with its steps. While it runs the dialog can't
 * be closed and the database is read-only; on success the app restarts by itself.
 */
function MoveDataDialog({
  from,
  target,
  onClose
}: {
  from: string
  target: DataMoveTarget
  onClose: () => void
}): React.JSX.Element {
  const [phase, setPhase] = useState<'confirm' | 'moving' | 'failed'>('confirm')
  const [step, setStep] = useState<DataMoveStep | null>(null)
  const [error, setError] = useState('')

  useEffect(() => window.api.dataLocation.onProgress(setStep), [])

  const move = async (): Promise<void> => {
    setPhase('moving')
    try {
      const result = await window.api.dataLocation.move(target.folder)
      if (!result.ok) {
        setError(result.message)
        setPhase('failed')
      }
      // On success the app restarts in a moment; the dialog stays as it is until then.
    } catch (caught) {
      logError('renderer', caught)
      setError(userMessage(caught))
      setPhase('failed')
    }
  }

  const current = step ? STEPS.findIndex((item) => item.step === step) : -1

  return (
    <Dialog
      onClose={onClose}
      labelledBy="move-data-title"
      className="max-w-xl"
      locked={phase === 'moving'}
    >
      {(close) => (
        <div className="overflow-y-auto p-6">
          <h2
            id="move-data-title"
            className="font-display text-2xl text-[var(--color-text-primary)]"
          >
            Move your data
          </h2>
          <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[4rem_minmax(0,1fr)]">
            <dt className="text-[var(--color-text-muted)]">From</dt>
            <dd className="break-all text-[var(--color-text-secondary)]">{from}</dd>
            <dt className="text-[var(--color-text-muted)]">To</dt>
            <dd className="break-all font-semibold text-[var(--color-text-primary)]">
              {target.folder}
            </dd>
          </dl>

          {phase === 'confirm' ? (
            <>
              <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
                CineDiary makes a safety backup, copies your diary, posters, banners, safety backups
                and logs, checks that the copy matches, then restarts from the new folder. Nothing
                can change while it copies. Your old folder stays until you choose to delete it.
              </p>
              {target.warnings.map((warning) => (
                <p
                  key={warning}
                  className="mt-3 flex gap-2 rounded-[var(--radius-control)] bg-[var(--color-danger-surface)] p-3 text-sm text-[var(--color-danger)]"
                >
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {warning}
                </p>
              ))}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={close} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="button" onClick={() => void move()} className="btn btn-primary">
                  Move and restart
                </button>
              </div>
            </>
          ) : (
            <>
              <ol className="mt-5 space-y-2" aria-live="polite">
                {STEPS.map((item, index) => {
                  const done = phase === 'moving' && index < current
                  const active = phase === 'moving' && index === current
                  return (
                    <li
                      key={item.step}
                      className={`flex items-center gap-3 text-sm ${
                        done || active
                          ? 'text-[var(--color-text-primary)]'
                          : 'text-[var(--color-text-muted)]'
                      }`}
                    >
                      <span className="flex size-5 items-center justify-center">
                        {done ? (
                          <Check size={16} className="text-[var(--color-positive-icon)]" />
                        ) : active ? (
                          <Loader2
                            size={16}
                            className="animate-spin text-[var(--color-accent-light)] motion-reduce:animate-none"
                          />
                        ) : (
                          <span className="size-1.5 rounded-full bg-[var(--color-border)]" />
                        )}
                      </span>
                      {item.label}
                    </li>
                  )
                })}
              </ol>
              {phase === 'failed' ? (
                <>
                  <p className="mt-5 rounded-[var(--radius-control)] bg-[var(--color-danger-surface)] p-3 text-sm text-[var(--color-danger)]">
                    {error}
                  </p>
                  <div className="mt-6 flex justify-end">
                    <button type="button" onClick={close} className="btn btn-secondary">
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-5 text-xs text-[var(--color-text-muted)]">
                  Please keep CineDiary open. It restarts by itself when the move is done.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  )
}

export default MoveDataDialog
