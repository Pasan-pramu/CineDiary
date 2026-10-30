import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MOODS } from '../../../shared/constants'
import type { WatchEntry } from '../../../shared/types'
import WatchEntryDialog from './WatchEntryDialog'

// The watch dialog's first render (server-side, so no browser is needed): what the form shows
// before you touch anything. Moods come from a stub instead of the database.

vi.mock('../hooks/useMoods', () => ({
  useMoods: () =>
    DEFAULT_MOODS.map((mood, index) => ({
      ...mood,
      id: index + 1,
      isCustom: false,
      isHidden: false,
      sortOrder: index + 1,
      uses: 0
    })),
  useReasons: () => [],
  pickable: <T,>(items: T[]) => items,
  refreshMoods: async () => undefined
}))

const entry = (fields: Partial<WatchEntry>): WatchEntry => ({
  id: 1,
  titleId: 1,
  startedAt: '2026-10-01',
  completedAt: '2026-10-02',
  isRewatch: false,
  episodesWatched: 0,
  moodBefore: 'sad',
  moodBeforeScore: 3,
  reasonNote: null,
  moodAfter: 'calm',
  moodAfterScore: 7,
  thoughts: null,
  lessons: null,
  favoriteCharacter: null,
  favoriteScene: null,
  favoriteQuote: null,
  wouldRewatch: null,
  wouldRecommend: null,
  notes: null,
  isHighlight: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  reasons: [],
  ...fields
})

function render(props: Partial<Parameters<typeof WatchEntryDialog>[0]>): string {
  return renderToStaticMarkup(
    <WatchEntryDialog mode="edit" titleId={1} onClose={() => {}} onSaved={() => {}} {...props} />
  )
}

/** How many of the 10 stars are filled. */
const filledStars = (html: string): number =>
  html.split('fill="var(--color-rating-icon)"').length - 1

/** The pressed score in a score group, e.g. "Mood score before". */
function pressedScore(html: string, group: string): string | null {
  const start = html.indexOf(`aria-label="${group}"`)
  if (start < 0) return null
  const end = html.indexOf('</div>', start)
  return html.slice(start, end).match(/aria-pressed="true"[^>]*>(\d+)</)?.[1] ?? null
}

describe('the watch dialog', () => {
  it('Edit memory shows the title’s current rating in the stars', () => {
    expect(filledStars(render({ entry: entry({}), initialRating: 7 }))).toBe(7)
    expect(filledStars(render({ mode: 'finish', entry: entry({}), initialRating: 4 }))).toBe(4)
    expect(filledStars(render({ entry: entry({}), initialRating: null }))).toBe(0)
  })

  it('editing an in-progress watch has no completed date or "after" (it stays in progress)', () => {
    const html = render({ entry: entry({ completedAt: null, moodAfter: null }) })
    expect(html).toContain('This watch stays in progress')
    expect(html).not.toContain('Completed')
    expect(html).not.toContain('How did you feel after?')
    expect(render({ entry: entry({}) })).toContain('How did you feel after?')
  })

  it('scores are ten buttons (1–10), never a free number field', () => {
    const html = render({ entry: entry({}) })
    expect(html).not.toMatch(/type="number"[^>]*min="1"[^>]*max="10"/)
    expect(pressedScore(html, 'Mood score before')).toBe('3')
    expect(pressedScore(html, 'Mood score after')).toBe('7')
    const group = html.slice(html.indexOf('aria-label="Mood score before"'))
    for (let score = 1; score <= 10; score++) expect(group).toContain(`>${score}</button>`)
  })

  it('marks every feeling as optional', () => {
    const html = render({ mode: 'past', entry: undefined })
    for (const label of [
      'How did you feel before?',
      'Why did you watch it?',
      'A note about why',
      'How did you feel after?',
      'Personal rating'
    ])
      expect(html, label).toContain(
        `${label} <span class="text-xs text-[var(--color-text-muted)]">(optional)</span>`
      )
  })

  it('on the watch saved with a new title: Skip, and Save & add another past movie', () => {
    const html = render({
      mode: 'past',
      entry: entry({ moodBefore: null, moodBeforeScore: null, moodAfter: null }),
      intro: 'Saved as watched today.',
      cancelLabel: 'Skip',
      onSaveAndAddAnother: () => {}
    })
    expect(html).toContain('Saved as watched today.')
    expect(html).toContain('>Skip</button>')
    expect(html).toContain('Save &amp; add another past movie')
    expect(render({ mode: 'past', entry: undefined })).not.toContain('add another past movie')
  })

  it('a mood picked in advance (Discover) comes with its suggested score', () => {
    const html = render({ mode: 'start', entry: undefined, initialMoodBefore: 'stressed' })
    expect(pressedScore(html, 'Mood score before')).toBe('3')
    const custom = render({ mode: 'start', entry: undefined, initialMoodBefore: 'nostalgic_1a2b' })
    expect(pressedScore(custom, 'Mood score before')).toBeNull()
  })
})
