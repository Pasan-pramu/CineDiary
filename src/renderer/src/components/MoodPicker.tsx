import { MOODS, type MoodKey } from '../../../shared/constants'

interface MoodPickerProps {
  value?: MoodKey
  onChange: (mood: MoodKey) => void
}

function MoodPicker({ value, onChange }: MoodPickerProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-5 gap-2">
      {MOODS.map((mood) => (
        <button
          key={mood.key}
          type="button"
          onClick={() => onChange(mood.key)}
          className={`rounded-[var(--radius-control)] border p-2 text-center transition ${value === mood.key ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border)] hover:bg-[var(--color-panel-elevated)]'}`}
        >
          <span className="block text-xl">{mood.emoji}</span>
          <span className="mt-1 block text-[10px] text-[var(--color-text-muted)]">
            {mood.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export default MoodPicker
