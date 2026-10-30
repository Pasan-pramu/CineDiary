import { ArrowRight, Loader2, Search } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PosterPlaceholder from '../components/PosterPlaceholder'
import { chapterDates } from '../components/timeline/chapterDates'
import { chapterColorVar } from '../../../shared/timeline'
import type { GlobalSearchResult } from '../../../shared/types'
import { formatWatchDate } from '../format'
import { failed } from '../errors'

// The top-bar search (Ctrl+K): titles, journal text and life chapters, searched in the main
// process. ↑/↓ move, Enter opens, Esc closes the results (and, pressed again, clears).

const SEARCH_DELAY_MS = 250
const MIN_LENGTH = 2

interface Option {
  id: string
  group: 'Titles' | 'Journal' | 'Chapters'
  path: string
  content: React.ReactNode
}

function Thumb({
  titleId,
  title,
  posterFile
}: {
  titleId: number
  title: string
  posterFile: string | null
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  return (
    <span className="block w-8 shrink-0 overflow-hidden rounded-md">
      {posterFile && !failed ? (
        <img
          src={`poster://titles/${titleId}`}
          alt=""
          onError={() => setFailed(true)}
          className="aspect-[2/3] w-full object-cover"
        />
      ) : (
        <PosterPlaceholder title={title} compact />
      )}
    </span>
  )
}

/** The dropdown's rows, in order, so the keyboard can walk them. */
function optionsFor(result: GlobalSearchResult): Option[] {
  const q = encodeURIComponent(result.query)
  const options: Option[] = []
  for (const hit of result.titles.items) {
    options.push({
      id: `title-${hit.id}`,
      group: 'Titles',
      path: `/title/${hit.id}`,
      content: (
        <>
          <Thumb titleId={hit.id} title={hit.title} posterFile={hit.posterFile} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--color-text-primary)]">
              {hit.title}
            </span>
            <span className="block truncate text-xs text-[var(--color-text-muted)]">
              {[hit.type === 'series' ? 'Series' : 'Movie', hit.year, hit.match]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </>
      )
    })
  }
  if (result.titles.total > 0) {
    options.push({
      id: 'all-titles',
      group: 'Titles',
      path: `/collection?q=${q}`,
      content: <SeeAll>See all {result.titles.total} in Collection</SeeAll>
    })
  }
  for (const hit of result.journal.items) {
    options.push({
      id: `entry-${hit.entryId}`,
      group: 'Journal',
      path: `/title/${hit.titleId}`,
      content: (
        <>
          <Thumb titleId={hit.titleId} title={hit.title} posterFile={hit.posterFile} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--color-text-primary)]">
              {hit.title}
              <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                {formatWatchDate(hit.date, hit.datePrecision)} · {hit.field}
              </span>
            </span>
            <span className="block truncate text-xs italic text-[var(--color-text-secondary)]">
              “{hit.snippet}”
            </span>
          </span>
        </>
      )
    })
  }
  if (result.journal.total > 0) {
    options.push({
      id: 'all-journal',
      group: 'Journal',
      path: `/journal?q=${q}`,
      content: <SeeAll>See all {result.journal.total} in Journal</SeeAll>
    })
  }
  for (const hit of result.chapters.items) {
    options.push({
      id: `chapter-${hit.id}`,
      group: 'Chapters',
      path: `/timeline?chapter=${hit.id}`,
      content: (
        <>
          <span
            className="h-8 w-1.5 shrink-0 rounded-full"
            style={{ background: chapterColorVar(hit.color) }}
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--color-text-primary)]">
              {hit.name}
              <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                {chapterDates({ ...hit, note: null })}
              </span>
            </span>
            {hit.snippet ? (
              <span className="block truncate text-xs italic text-[var(--color-text-secondary)]">
                {hit.snippet}
              </span>
            ) : null}
          </span>
        </>
      )
    })
  }
  return options
}

function SeeAll({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent-light)]">
      {children} <ArrowRight size={13} />
    </span>
  )
}

function GlobalSearch({
  inputRef
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
}): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const listId = useId()
  const [text, setText] = useState('')
  const [result, setResult] = useState<GlobalSearchResult | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Closes when the page changes (also after picking a result).
  const [page, setPage] = useState(location.key)
  if (page !== location.key) {
    setPage(location.key)
    setOpen(false)
  }

  const query = text.trim()
  const searching = query.length >= MIN_LENGTH && result?.query !== query

  useEffect(() => {
    if (query.length < MIN_LENGTH) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void window.api.search
        .global(query)
        .then((next) => {
          if (cancelled) return
          setResult(next)
          setActive(-1)
        })
        .catch(failed('Search didn’t work. Try again in a moment.'))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const shown = query.length >= MIN_LENGTH && result !== null ? result : null
  const options = shown ? optionsFor(shown) : []
  const expanded = open && query.length >= MIN_LENGTH

  const choose = (option: Option): void => {
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
    void navigate(option.path)
  }

  const activeIndex = active < options.length ? active : -1
  const activeOption = options[activeIndex]

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (expanded) setOpen(false)
      else {
        setText('')
        event.currentTarget.blur()
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!options.length) return
      event.preventDefault()
      setOpen(true)
      // -1 means "nothing selected": ↓ from the last row and ↑ from the first go back there.
      setActive((current) =>
        event.key === 'ArrowDown'
          ? current + 1 >= options.length
            ? -1
            : current + 1
          : current - 1 < -1
            ? options.length - 1
            : current - 1
      )
    } else if (event.key === 'Enter') {
      const option = options[activeIndex] ?? options[0]
      if (option && expanded) {
        event.preventDefault()
        choose(option)
      }
    }
  }

  let lastGroup: Option['group'] | null = null
  return (
    <div className="relative max-w-2xl flex-1">
      <Search
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${listId}-${activeOption.id}` : undefined}
        aria-label="Search everything"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => {
          setOpen(true)
          setActive(-1)
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Search titles, journal, chapters…"
        className="field w-full pl-11 pr-16"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        {searching ? (
          <Loader2
            size={16}
            className="animate-spin text-[var(--color-text-muted)] motion-reduce:animate-none"
          />
        ) : text ? null : (
          <kbd className="rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]">
            Ctrl K
          </kbd>
        )}
      </span>
      {expanded && shown ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          // Keep focus in the input while clicking a result.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel)] p-2 shadow-[var(--shadow-raised)]"
        >
          {options.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
              Nothing matches “{shown.query}”.
            </p>
          ) : (
            options.map((option, index) => {
              const heading = option.group !== lastGroup ? option.group : null
              lastGroup = option.group
              return (
                <div key={option.id}>
                  {heading ? <p className="eyebrow px-3 pb-1 pt-3 first:pt-1">{heading}</p> : null}
                  <div
                    id={`${listId}-${option.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm ${
                      index === activeIndex ? 'bg-[var(--color-panel-elevated)]' : ''
                    }`}
                  >
                    {option.content}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}

export default GlobalSearch
