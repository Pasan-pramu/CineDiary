import { useId } from 'react'
import { getLocalDate } from '../../../shared/constants'
import type { DatePrecision } from '../../../shared/watchDate'

// "When did you finish it?" for a finished watch: an exact date, a month, a year, or
// "I don't remember" (it still counts as watched). `date` is always a full YYYY-MM-DD here; a
// month or year keeps its first day, and main stores it that way (shared/watchDate.ts).

const CHOICES: ReadonlyArray<{ value: DatePrecision; label: string }> = [
  { value: 'day', label: 'Exact date' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'unknown', label: 'I don’t remember' }
]

/** Years to pick from, newest first. */
const FIRST_YEAR = 1920

interface FinishedDateFieldProps {
  precision: DatePrecision
  date: string
  onPrecisionChange: (precision: DatePrecision) => void
  onDateChange: (date: string) => void
}

function FinishedDateField({
  precision,
  date,
  onPrecisionChange,
  onDateChange
}: FinishedDateFieldProps): React.JSX.Element {
  const labelId = useId()
  const today = getLocalDate()
  const thisYear = Number(today.slice(0, 4))
  return (
    <div>
      <p id={labelId} className="text-sm text-[var(--color-text-secondary)]">
        Finished
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="segmented mt-2 max-w-full flex-wrap"
      >
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={precision === choice.value}
            onClick={() => onPrecisionChange(choice.value)}
            className="segment"
          >
            {choice.label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {precision === 'day' ? (
          <input
            type="date"
            aria-label="Finished on"
            value={date}
            max={today}
            onChange={(event) => onDateChange(event.target.value)}
            className="field w-full sm:w-56"
          />
        ) : precision === 'month' ? (
          <input
            type="month"
            aria-label="Finished in (month)"
            value={date.slice(0, 7)}
            max={today.slice(0, 7)}
            onChange={(event) => event.target.value && onDateChange(`${event.target.value}-01`)}
            className="field w-full sm:w-56"
          />
        ) : precision === 'year' ? (
          <select
            aria-label="Finished in (year)"
            value={date.slice(0, 4)}
            onChange={(event) => onDateChange(`${event.target.value}-01-01`)}
            className="field w-full sm:w-40"
          >
            {Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, index) => {
              const year = String(thisYear - index)
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              )
            })}
          </select>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">
            No date needed. It still counts as watched, everywhere except date-based views.
          </p>
        )}
      </div>
    </div>
  )
}

export default FinishedDateField
