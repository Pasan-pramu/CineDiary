import { useState } from 'react'
import { isOneCharacter } from '../../../shared/validation'
import { userMessage } from '../errors'

/** Emoji to pick from quickly; any other one can be typed or pasted (Win + . opens the picker). */
const SUGGESTED_EMOJI = ['😊', '🥹', '😤', '🥱', '🤩', '😬', '🫠', '🤔', '💪', '🌧️']

interface InlineAddFormProps {
  /** "mood" asks for an emoji too. */
  kind: 'mood' | 'reason'
  onSave: (input: { label: string; emoji: string }) => Promise<void>
  onCancel: () => void
}

/**
 * The small "+ New mood" / "+ New reason" form right where you pick them, so you can add one
 * while logging. Esc cancels it (without closing the dialog around it).
 */
function InlineAddForm({ kind, onSave, onCancel }: InlineAddFormProps): React.JSX.Element {
  const [label, setLabel] = useState('')
  const [emoji, setEmoji] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const name = label.trim()
    if (!name) return setError('Give it a name.')
    if (kind === 'mood' && !isOneCharacter(emoji.trim())) return setError('Pick one emoji.')
    setSaving(true)
    try {
      await onSave({ label: name, emoji: emoji.trim() })
    } catch (caught) {
      setError(userMessage(caught))
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Stops the dialog's own Esc handling: only this form closes.
        event.preventDefault()
        event.stopPropagation()
        onCancel()
      }}
      className="panel mt-3 space-y-3 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        {kind === 'mood' ? (
          <input
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            aria-label="Emoji"
            placeholder="🙂"
            className="field w-16 text-center text-lg"
          />
        ) : null}
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          aria-label={kind === 'mood' ? 'New mood' : 'New reason'}
          placeholder={kind === 'mood' ? 'e.g. Nostalgic' : 'e.g. Rainy Sunday'}
          maxLength={40}
          autoFocus
          className="field min-w-40 flex-1"
        />
        <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
          Add
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
      </div>
      {kind === 'mood' ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Suggested emoji">
          {SUGGESTED_EMOJI.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmoji(option)}
              aria-pressed={emoji === option}
              aria-label={`Use ${option}`}
              className="btn btn-ghost btn-icon btn-sm text-lg aria-pressed:bg-[var(--color-accent-muted)]"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
    </form>
  )
}

export default InlineAddForm
