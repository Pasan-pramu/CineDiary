import { Compass, Lightbulb, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageTitle from '../components/PageTitle'
import PosterPlaceholder from '../components/PosterPlaceholder'
import SectionPanel from '../components/SectionPanel'
import WatchEntryDialog from '../components/WatchEntryDialog'
import { changeColor, formatChange, watchCount } from '../components/insightSentences'
import { DISCOVER_PROMPTS, findPrompt, type DiscoverPrompt } from '../../../shared/discoverPrompts'
import type {
  DiscoverItem,
  DiscoverQuery,
  DiscoverResult,
  RecommendationTypeFilter,
  Title
} from '../../../shared/types'

const TYPES: { value: RecommendationTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'Series' }
]

const RUNTIMES: { value: number | null; label: string }[] = [
  { value: null, label: 'Any length' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1½ hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' }
]

/** Reads the prompt and filters from the URL (so a link brings back the same view). */
function queryFromParams(params: URLSearchParams): DiscoverQuery | null {
  const prompt = findPrompt(params.get('prompt'))
  if (!prompt) return null
  const type = params.get('type')
  const maxRuntime = Number(params.get('maxRuntime'))
  return {
    prompt: prompt.key,
    type: type === 'movie' || type === 'series' ? type : 'all',
    maxRuntime: Number.isInteger(maxRuntime) && maxRuntime > 0 ? maxRuntime : null,
    includeRewatches: params.get('rewatches') !== '0',
    includeUnknownRuntime: params.get('unknownRuntime') === '1'
  }
}

function monthsBetween(isoDate: string, now: number): number {
  return Math.max(1, Math.round((now - Date.parse(`${isoDate}T00:00:00`)) / (30.44 * 86_400_000)))
}

function WhyLine({
  why,
  prompt,
  now
}: {
  why: DiscoverItem['why']
  prompt: DiscoverPrompt
  now: number
}): React.JSX.Element {
  const note = (text: string | null): React.ReactNode =>
    text ? <span className="italic text-[var(--color-text-muted)]"> · “{text}”</span> : null
  switch (why.kind) {
    case 'history':
      return (
        <>
          {why.label}: {why.before} → {why.after} ·{' '}
          <span className="font-semibold" style={{ color: changeColor(why.averageChange) }}>
            {formatChange(why.averageChange)}
          </span>{' '}
          on average · based on {watchCount(why.n)}
          {note(why.note)}
        </>
      )
    case 'genre':
      return (
        <>
          {why.genre} lifted your mood by{' '}
          <span className="font-semibold" style={{ color: changeColor(why.averageChange) }}>
            {formatChange(why.averageChange)}
          </span>{' '}
          when {prompt.when} (based on {watchCount(why.n)})
        </>
      )
    case 'genreFallback':
      return (
        <>
          {why.genre} is a classic pick when {prompt.when}{' '}
          <span className="text-[var(--color-text-muted)]">— not from your history yet</span>
        </>
      )
    case 'revisit': {
      const who = why.favorite
        ? why.rating
          ? `A favorite you rated ${why.rating}`
          : 'One of your favorites'
        : `You rated it ${why.rating}`
      const months = monthsBetween(why.lastWatched, now)
      return (
        <>
          {who} · last watched {months === 1 ? 'a month' : `${months} months`} ago
          {why.genre ? ` · ${why.genre}` : ''}
          {why.history
            ? ` · ${why.history.label}: ${why.history.before} → ${why.history.after}`
            : ''}
          {note(why.history?.note ?? null)}
        </>
      )
    }
  }
}

function ResultCard({
  item,
  prompt,
  now,
  onStart
}: {
  item: DiscoverItem
  prompt: DiscoverPrompt
  now: number
  onStart: (title: Title) => void
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const { title } = item
  return (
    <article className="flex gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/50 p-3">
      <Link
        to={`/title/${title.id}`}
        className="w-20 shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/20"
      >
        {title.posterFile && !failed ? (
          <img
            src={`poster://titles/${title.id}`}
            alt=""
            onError={() => setFailed(true)}
            className="aspect-[2/3] w-full object-cover"
          />
        ) : (
          <PosterPlaceholder title={title.title} compact />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={`/title/${title.id}`}
          className="truncate font-semibold text-[var(--color-text-primary)] hover:underline"
        >
          {title.title}
        </Link>
        <p className="text-xs text-[var(--color-text-muted)]">
          {title.type === 'series' ? 'TV Series' : 'Movie'}
          {title.year ? ` · ${title.year}` : ''}
          {title.runtimeMinutes
            ? ` · ${title.runtimeMinutes} min${title.type === 'series' ? ' episodes' : ''}`
            : ''}
        </p>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--color-text-secondary)]">
          <WhyLine why={item.why} prompt={prompt} now={now} />
        </p>
        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={() => onStart(title)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-accent-light)]"
          >
            <Play size={13} /> Start watching
          </button>
        </div>
      </div>
    </article>
  )
}

function GroupNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-5 text-sm leading-6 text-[var(--color-text-muted)]">
      {children}
    </p>
  )
}

function Group({
  title,
  subtitle,
  items,
  empty,
  ...card
}: {
  title: string
  subtitle: string
  items: DiscoverItem[]
  empty: React.ReactNode
  prompt: DiscoverPrompt
  now: number
  onStart: (title: Title) => void
}): React.JSX.Element {
  return (
    <SectionPanel title={title}>
      <p className="-mt-3 mb-4 text-xs text-[var(--color-text-muted)]">{subtitle}</p>
      {items.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <ResultCard key={item.title.id} item={item} {...card} />
          ))}
        </div>
      ) : (
        <GroupNote>{empty}</GroupNote>
      )}
    </SectionPanel>
  )
}

/** How to get better suggestions: shown when a prompt has nothing to go on yet. */
function NotEnoughData({ hasMoodHistory }: { hasMoodHistory: boolean }): React.JSX.Element {
  return (
    <SectionPanel title="Not enough data yet">
      <div className="flex gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-rating)]/15 text-[var(--color-rating)]">
          <Lightbulb size={20} />
        </span>
        <div className="text-sm leading-6 text-[var(--color-text-secondary)]">
          <p>
            {hasMoodHistory
              ? 'Your diary doesn’t have enough moments like this one yet.'
              : 'Discover learns from how stories made you feel, and you haven’t logged moods yet.'}{' '}
            Suggestions come only from your own history, so they get better as you log:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--color-text-muted)]">
            <li>
              When you <strong>start</strong> watching: pick your mood and score, and a reason (e.g.
              “Stressed” or “Needed motivation”).
            </li>
            <li>
              When you <strong>finish</strong>: log your mood afterwards, so the change can be
              measured.
            </li>
            <li>Add titles you want to watch as “Planned” to fill your watchlist suggestions.</li>
          </ul>
          <p className="mt-3">
            Two matching watches are enough for the first suggestions.{' '}
            <Link to="/collection" className="text-[var(--color-accent-light)] hover:underline">
              Go to My Collection →
            </Link>
          </p>
        </div>
      </div>
    </SectionPanel>
  )
}

/** Discover / For My Mood: rule-based suggestions from my own diary. */
function Discover(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const query = queryFromParams(params)
  const prompt = query ? findPrompt(query.prompt) : null
  const queryKey = query ? JSON.stringify(query) : null
  const [result, setResult] = useState<{ key: string; value: DiscoverResult; at: number } | null>(
    null
  )
  const [reloads, setReloads] = useState(0)
  const [starting, setStarting] = useState<Title | null>(null)
  const [started, setStarted] = useState<Title | null>(null)

  useEffect(() => {
    if (!queryKey) return
    let cancelled = false
    void window.api.recommendations
      .discover(JSON.parse(queryKey) as DiscoverQuery)
      .then((value) => {
        if (!cancelled) setResult({ key: queryKey, value, at: Date.now() })
      })
    return () => {
      cancelled = true
    }
  }, [queryKey, reloads])

  const update = (changes: Record<string, string | null>): void => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const current = result && result.key === queryKey ? result.value : null
  const nothing =
    current !== null &&
    !current.helped.enoughData &&
    current.watchlist.length === 0 &&
    current.revisit.items.length === 0
  const cardProps = prompt && result ? { prompt, now: result.at, onStart: setStarting } : null

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle description="Tell CineDiary how you feel. Suggestions come only from your own diary — what lifted you before, and what’s waiting on your watchlist.">
        For My Mood
      </PageTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DISCOVER_PROMPTS.map((option) => {
          const active = option.key === prompt?.key
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => update({ prompt: option.key })}
              className={`rounded-[var(--radius-panel)] border p-5 text-left transition hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-lg shadow-[var(--color-accent)]/15'
                  : 'border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-accent)]/50'
              }`}
            >
              <span className="text-3xl" aria-hidden="true">
                {option.emoji}
              </span>
              <p className="mt-3 font-display text-xl text-[var(--color-text-primary)]">
                {option.label}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{option.description}</p>
            </button>
          )
        })}
      </div>

      {!query || !prompt ? (
        <div className="mt-8 flex flex-col items-center rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-12 text-center">
          <Compass size={26} className="text-[var(--color-accent-light)]" />
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
            Pick how you feel to see what has helped you before.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex rounded-[var(--radius-control)] border border-[var(--color-border)] p-0.5">
              {TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={query.type === option.value}
                  onClick={() => update({ type: option.value === 'all' ? null : option.value })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    query.type === option.value
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-[var(--color-text-muted)] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              I have
              <select
                value={query.maxRuntime ?? ''}
                onChange={(event) => update({ maxRuntime: event.target.value || null })}
                className="h-9 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-2 text-sm text-white"
              >
                {RUNTIMES.map((option) => (
                  <option key={option.label} value={option.value ?? ''}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={query.includeRewatches}
                onChange={(event) => update({ rewatches: event.target.checked ? null : '0' })}
                className="accent-[var(--color-accent)]"
              />
              Include rewatches
            </label>
          </div>

          {current && current.hiddenUnknownRuntime > 0 ? (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              {current.hiddenUnknownRuntime === 1
                ? '1 title without a runtime is hidden.'
                : `${current.hiddenUnknownRuntime} titles without a runtime are hidden.`}{' '}
              <button
                type="button"
                onClick={() => update({ unknownRuntime: '1' })}
                className="text-[var(--color-accent-light)] hover:underline"
              >
                Show them anyway
              </button>
            </p>
          ) : null}

          {started ? (
            <p className="mt-4 rounded-[var(--radius-control)] bg-[var(--color-positive)]/10 px-4 py-3 text-sm text-[var(--color-positive)]">
              Started watching {started.title}. Enjoy!{' '}
              <Link to={`/title/${started.id}`} className="font-semibold hover:underline">
                Open it →
              </Link>
            </p>
          ) : null}

          <div className="mt-6 space-y-6">
            {!current || !cardProps ? null : nothing ? (
              <NotEnoughData hasMoodHistory={current.hasMoodHistory} />
            ) : (
              <>
                <Group
                  title="Helped you before"
                  subtitle={`What lifted your mood when ${prompt.when}.`}
                  items={current.helped.items}
                  empty={
                    current.helped.hidden
                      ? 'Hidden because “Include rewatches” is off.'
                      : !current.helped.enoughData
                        ? `Not enough data yet: this needs at least 2 finished watches with a mood before and after when ${prompt.when} (you have ${current.helped.n}).`
                        : 'Nothing in your history lifted your mood in a moment like this yet.'
                  }
                  {...cardProps}
                />
                <Group
                  title="From your watchlist"
                  subtitle="Planned titles in genres that lifted you in moments like this."
                  items={current.watchlist}
                  empty="No planned titles match this feeling. Add titles you want to watch as “Planned”."
                  {...cardProps}
                />
                <Group
                  title="Haven’t watched in a while"
                  subtitle="Favorites and titles you rated 8+ that you last watched over 6 months ago."
                  items={current.revisit.items}
                  empty={
                    current.revisit.hidden
                      ? 'Hidden because “Include rewatches” is off.'
                      : 'No favorites or highly rated titles fit this feeling right now.'
                  }
                  {...cardProps}
                />
              </>
            )}
          </div>
        </>
      )}

      {starting && prompt ? (
        <WatchEntryDialog
          mode="start"
          titleId={starting.id}
          totalEpisodes={starting.totalEpisodes}
          initialMoodBefore={prompt.startMood}
          initialReasonKeys={prompt.startReason ? [prompt.startReason] : []}
          onClose={() => setStarting(null)}
          onSaved={() => {
            setStarted(starting)
            setStarting(null)
            setReloads((count) => count + 1)
          }}
        />
      ) : null}
    </div>
  )
}

export default Discover
