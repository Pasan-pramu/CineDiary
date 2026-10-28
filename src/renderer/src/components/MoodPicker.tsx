import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { MoodKey } from '../../../shared/constants'
import { pickable, refreshMoods, useMoods } from '../hooks/useMoods'
import InlineAddForm from './InlineAddForm'

interface MoodPickerProps {
  value?: MoodKey
  onChange: (mood: MoodKey) => void
}

/** Your moods in your order; a hidden one only shows when it's already chosen (old entries). */
function MoodPicker({ value, onChange }: MoodPickerProps): React.JSX.Element {
  const moods = useMoods()
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {pickable(moods, (mood) => mood.key === value).map((mood) => (
          <button
            key={mood.key}
            type="button"
            onClick={() => onChange(mood.key)}
            aria-pressed={value === mood.key}
            className={`rounded-[var(--radius-control)] border p-2 text-center transition ${value === mood.key ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border)] hover:bg-[var(--color-panel-elevated)]'}`}
          >
            <span className="block text-xl">{mood.emoji}</span>
            <span className="mt-1 block truncate text-xs text-[var(--color-text-muted)]">
              {mood.label}
            </span>
          </button>
        ))}
        {adding ? null : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent-light)]"
          >
            <Plus size={18} />
            <span className="mt-1 block text-xs">New mood</span>
          </button>
        )}
      </div>
      {adding ? (
        <InlineAddForm
          kind="mood"
          onCancel={() => setAdding(false)}
          onSave={async (input) => {
            const mood = await window.api.moods.create(input)
            await refreshMoods()
            onChange(mood.key)
            setAdding(false)
          }}
        />
      ) : null}
    </div>
  )
}

export default MoodPicker
