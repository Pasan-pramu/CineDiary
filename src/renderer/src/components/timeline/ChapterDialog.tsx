import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { getLocalDate } from '../../../../shared/constants'
import { CHAPTER_COLORS, chapterColorVar, type ChapterColor } from '../../../../shared/timeline'
import type { LifePeriod } from '../../../../shared/types'
import { lifePeriodInputSchema } from '../../../../shared/validation'
import { useEscape } from '../../hooks/useEscape'

const COLOR_NAMES: Record<ChapterColor, string> = {
  violet: 'Violet',
  blue: 'Blue',
  green: 'Green',
  amber: 'Amber',
  rose: 'Rose',
  teal: 'Teal'
}

const fieldClass =
  'h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]'

interface ChapterDialogProps {
  /** Edit this chapter; omit to create a new one. */
  chapter?: LifePeriod
  onClose: () => void
  onSaved: () => void
}

/** Create, edit or delete a life chapter (e.g. "Final year at university"). */
function ChapterDialog({ chapter, onClose, onSaved }: ChapterDialogProps): React.JSX.Element {
  useEscape(onClose)
  const [name, setName] = useState(chapter?.name ?? '')
  const [startDate, setStartDate] = useState(chapter?.startDate ?? getLocalDate())
  const [ongoing, setOngoing] = useState(chapter ? chapter.endDate === null : true)
  const [endDate, setEndDate] = useState(chapter?.endDate ?? getLocalDate())
  const [color, setColor] = useState<ChapterColor>(chapter?.color ?? 'violet')
  const [note, setNote] = useState(chapter?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    const parsed = lifePeriodInputSchema.safeParse({
      name,
      startDate,
      endDate: ongoing ? null : endDate,
      color,
      note: note.trim() || null
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the chapter details.')
      return
    }
    setSaving(true)
    void (
      chapter
        ? window.api.timeline.updateChapter(chapter.id, parsed.data)
        : window.api.timeline.createChapter(parsed.data)
    )
      .then(onSaved)
      .catch(() => setError('The chapter couldn’t be saved.'))
      .finally(() => setSaving(false))
  }

  const remove = (): void => {
    if (!chapter) return
    if (!window.confirm(`Delete the chapter “${chapter.name}”? Your watches stay as they are.`))
      return
    void window.api.timeline.deleteChapter(chapter.id).then(onSaved)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={chapter ? 'Edit chapter' : 'New chapter'}
    >
      <form
        onSubmit={save}
        className="w-full max-w-lg rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-raised)]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl text-[var(--color-text-primary)]">
            {chapter ? 'Edit chapter' : 'New life chapter'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 text-sm">
          <label className="block">
            <span className="mb-1.5 block font-semibold text-[var(--color-text-secondary)]">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Final year at university"
              maxLength={80}
              className={fieldClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block font-semibold text-[var(--color-text-secondary)]">
                Starts
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-semibold text-[var(--color-text-secondary)]">
                Ends
              </span>
              <input
                type="date"
                value={endDate}
                disabled={ongoing}
                onChange={(event) => setEndDate(event.target.value)}
                className={`${fieldClass} disabled:opacity-40`}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={ongoing}
              onChange={(event) => setOngoing(event.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Still going (no end date yet)
          </label>
          <div>
            <span className="mb-1.5 block font-semibold text-[var(--color-text-secondary)]">
              Color
            </span>
            <div className="flex flex-wrap gap-2">
              {CHAPTER_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={COLOR_NAMES[option]}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                  className={`size-8 rounded-full ring-offset-2 ring-offset-[var(--color-panel)] transition ${
                    color === option ? 'ring-2 ring-[var(--color-text-primary)]' : ''
                  }`}
                  style={{ background: chapterColorVar(option) }}
                />
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block font-semibold text-[var(--color-text-secondary)]">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What this time of your life was like"
              className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
        </div>
        <div className="mt-6 flex items-center gap-3">
          {chapter ? (
            <button
              type="button"
              onClick={remove}
              className="flex items-center gap-2 text-sm text-[var(--color-favorite)] hover:underline"
            >
              <Trash2 size={15} /> Delete chapter
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {chapter ? 'Save chapter' : 'Add chapter'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChapterDialog
