import { useId } from 'react'
import { WATCHED_ANSWERS, type WatchedAnswer } from '../../../shared/constants'

// "Have you watched it?" in Add Title and Quick Add, instead of a status list that looked like
// the place to log a watch but saved no watch and no feelings.

const HINTS: Record<WatchedAnswer, string> = {
  not_yet: 'Saved to your watchlist.',
  watching: 'Next: how you feel as you start. Every feeling is optional.',
  watched: 'Next: how it felt. Every feeling is optional.',
  dropped: 'Saved as dropped, without a watch.'
}

interface WatchedQuestionProps {
  value: WatchedAnswer
  onChange: (answer: WatchedAnswer) => void
}

function WatchedQuestion({ value, onChange }: WatchedQuestionProps): React.JSX.Element {
  const labelId = useId()
  return (
    <div>
      <p id={labelId} className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
        Have you watched it?
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="segmented">
          {WATCHED_ANSWERS.map((answer) => (
            <button
              key={answer.value}
              type="button"
              role="radio"
              aria-checked={value === answer.value}
              onClick={() => onChange(answer.value)}
              className="segment"
            >
              {answer.label}
            </button>
          ))}
        </div>
        {/* The smaller choice: you stopped partway and don't plan to finish. */}
        <button
          type="button"
          role="radio"
          aria-checked={value === 'dropped'}
          onClick={() => onChange('dropped')}
          className={value === 'dropped' ? 'chip chip-selected' : 'chip'}
        >
          Dropped
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{HINTS[value]}</p>
    </div>
  )
}

export default WatchedQuestion
