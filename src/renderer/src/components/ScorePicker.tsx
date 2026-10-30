interface ScorePickerProps {
  /** Names the group for screen readers, e.g. "Mood score before". */
  label: string
  value: number | null
  onChange: (score: number | null) => void
}

const SCORES = Array.from({ length: 10 }, (_, index) => index + 1)

/** A mood score: ten buttons from 1 (very low) to 10 (great), and Clear (scores are optional). */
function ScorePicker({ label, value, onChange }: ScorePickerProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label={label} className="segmented">
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            aria-pressed={value === score}
            className="segment w-9 px-0 tabular-nums"
          >
            {score}
          </button>
        ))}
      </div>
      {value !== null ? (
        <button type="button" onClick={() => onChange(null)} className="link">
          Clear
        </button>
      ) : null}
    </div>
  )
}

export default ScorePicker
