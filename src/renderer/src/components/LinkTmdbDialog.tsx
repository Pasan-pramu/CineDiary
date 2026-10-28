import { ArrowLeft, Link2, X } from 'lucide-react'
import { useState } from 'react'
import {
  defaultLinkChoices,
  LINK_FIELDS,
  POSTER_CHOICE,
  sameValue,
  valuesFromDraft,
  valuesFromTitle,
  type TmdbFieldValues
} from '../../../shared/tmdbFields'
import type { LinkChoice, Title, TmdbPick } from '../../../shared/types'
import PosterPlaceholder from './PosterPlaceholder'
import TmdbSearch from './TmdbSearch'
import { useEscape } from '../hooks/useEscape'

interface LinkTmdbDialogProps {
  title: Title
  onClose: () => void
  onLinked: (title: Title) => void
  /** Asked right before applying (e.g. "discard unsaved changes?"); false cancels. */
  confirmApply?: () => boolean
}

function formatValue(
  key: keyof TmdbFieldValues,
  value: TmdbFieldValues[keyof TmdbFieldValues]
): string | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.length ? value.join(', ') : null
  if (key === 'runtimeMinutes') return `${value} min`
  const text = String(value).trim()
  return text || null
}

function ChoiceButton({
  active,
  disabled,
  onClick,
  children
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`w-full rounded-[var(--radius-control)] border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]'
          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Link a manual title to TMDB: search, pick a match, then choose per field whether to keep
 * mine or use TMDB's. Nothing changes until Apply; personal data is never touched.
 */
function LinkTmdbDialog({
  title,
  onClose,
  onLinked,
  confirmApply
}: LinkTmdbDialogProps): React.JSX.Element {
  useEscape(onClose)
  const [pick, setPick] = useState<TmdbPick | null>(null)
  const [choices, setChoices] = useState<Record<string, LinkChoice>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [posterFailed, setPosterFailed] = useState(false)

  const mine = valuesFromTitle(title)
  const tmdb = pick ? valuesFromDraft(pick.draft) : null
  const fields = LINK_FIELDS.filter((field) => !field.seriesOnly || title.type === 'series')

  const choose = (picked: TmdbPick): void => {
    setPick(picked)
    setError(null)
    setChoices(
      defaultLinkChoices(mine, valuesFromDraft(picked.draft), {
        mine: title.posterFile !== null,
        tmdb: picked.poster !== null
      })
    )
  }

  const apply = (): void => {
    if (!pick) return
    if (confirmApply && !confirmApply()) return
    setSaving(true)
    setError(null)
    void window.api.tmdb
      .link({
        titleId: title.id,
        tmdbId: pick.draft.tmdbId,
        choices,
        tempPosterFile: choices[POSTER_CHOICE] === 'tmdb' ? pick.poster?.tempFile : undefined
      })
      .then((result) => {
        if (result.ok) onLinked(result.data)
        else setError(result.error.message)
      })
      .finally(() => setSaving(false))
  }

  const setChoice = (key: string, choice: LinkChoice): void =>
    setChoices((current) => ({ ...current, [key]: choice }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Link to TMDB"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[var(--shadow-raised)]">
        <header className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
          <Link2 size={18} className="text-[var(--color-accent-light)]" />
          <h2 className="section-heading flex-1">Link “{title.title}” to TMDB</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X size={20} />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          {!pick || !tmdb ? (
            <>
              <p className="mb-4 text-sm text-[var(--color-text-muted)]">
                Find the matching {title.type === 'series' ? 'series' : 'movie'}. You’ll choose what
                to keep before anything changes.
              </p>
              <TmdbSearch bare initialQuery={title.title} typeFilter={title.type} onPick={choose} />
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-[var(--color-text-muted)]">
                For each field, keep yours or use TMDB’s. Your status, rating, favorite and watch
                memories are never changed.
              </p>
              <div className="grid grid-cols-[110px_1fr_1fr] gap-x-3 gap-y-2 text-sm">
                <span />
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Keep mine
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Use TMDB
                </span>

                <span className="pt-3 font-semibold text-[var(--color-text-secondary)]">
                  Poster
                </span>
                <ChoiceButton
                  active={choices[POSTER_CHOICE] === 'mine'}
                  onClick={() => setChoice(POSTER_CHOICE, 'mine')}
                >
                  <div className="w-16">
                    {title.posterFile && !posterFailed ? (
                      <img
                        src={`poster://titles/${title.id}`}
                        alt="My poster"
                        onError={() => setPosterFailed(true)}
                        className="aspect-[2/3] w-full rounded-md object-cover"
                      />
                    ) : (
                      <PosterPlaceholder title={title.title} compact />
                    )}
                  </div>
                </ChoiceButton>
                <ChoiceButton
                  active={choices[POSTER_CHOICE] === 'tmdb'}
                  disabled={!pick.poster}
                  onClick={() => setChoice(POSTER_CHOICE, 'tmdb')}
                >
                  {pick.poster ? (
                    <img
                      src={pick.poster.previewDataUrl}
                      alt="TMDB poster"
                      className="aspect-[2/3] w-16 rounded-md object-cover"
                    />
                  ) : (
                    <span className="text-[var(--color-text-muted)]">No poster on TMDB</span>
                  )}
                </ChoiceButton>

                {fields.map(({ key, label }) => {
                  const mineText = formatValue(key, mine[key])
                  const tmdbText = formatValue(key, tmdb[key])
                  const same = sameValue(mine[key], tmdb[key])
                  return (
                    <div key={key} className="contents">
                      <span className="pt-3 font-semibold text-[var(--color-text-secondary)]">
                        {label}
                      </span>
                      {same ? (
                        <p className="col-span-2 rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] p-3 text-[var(--color-text-muted)]">
                          <span className="line-clamp-2">{mineText ?? 'Empty on both'}</span>
                          <span className="text-xs"> · same</span>
                        </p>
                      ) : (
                        <>
                          <ChoiceButton
                            active={choices[key] === 'mine'}
                            onClick={() => setChoice(key, 'mine')}
                          >
                            <span className="line-clamp-3">
                              {mineText ?? (
                                <em className="text-[var(--color-text-muted)]">Empty</em>
                              )}
                            </span>
                          </ChoiceButton>
                          <ChoiceButton
                            active={choices[key] === 'tmdb'}
                            disabled={tmdbText === null}
                            onClick={() => setChoice(key, 'tmdb')}
                          >
                            <span className="line-clamp-3">
                              {tmdbText ?? (
                                <em className="text-[var(--color-text-muted)]">Empty</em>
                              )}
                            </span>
                          </ChoiceButton>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              {error ? <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p> : null}
            </>
          )}
        </div>

        {pick ? (
          <footer className="flex items-center gap-3 border-t border-[var(--color-border)] px-6 py-4">
            <button
              type="button"
              onClick={() => setPick(null)}
              className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <ArrowLeft size={16} /> Pick another match
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={saving || pick.existingTitleId !== null}
              className="ml-auto rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {saving ? 'Linking…' : 'Apply and link'}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  )
}

export default LinkTmdbDialog
