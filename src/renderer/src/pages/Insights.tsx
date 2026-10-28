import {
  BarChart3,
  CalendarRange,
  Clapperboard,
  Clock,
  ListVideo,
  Star,
  Ticket,
  TrendingDown,
  TrendingUp,
  Tv
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import MoodTitleRow from '../components/MoodTitleRow'
import PageTitle from '../components/PageTitle'
import PeriodSelector from '../components/PeriodSelector'
import SectionHeading from '../components/SectionHeading'
import SectionPanel from '../components/SectionPanel'
import StatCard from '../components/StatCard'
import GenreDonutChart from '../components/charts/GenreDonutChart'
import MoodByGenreChart from '../components/charts/MoodByGenreChart'
import WatchesPerMonthChart from '../components/charts/WatchesPerMonthChart'
import ChaptersSection, { MAX_COMPARE } from '../components/insights/ChaptersSection'
import FeelingsSection from '../components/insights/FeelingsSection'
import { periodFromParams, periodParams, periodPhrase } from '../components/insights/period'
import {
  bestGenreSentence,
  changeColor,
  formatChange,
  reasonChangeSentence,
  watchCount
} from '../components/insightSentences'
import { useInsights } from '../hooks/useInsights'
import type {
  ChapterAnalysis,
  FeelingsAnalysis,
  Insights as InsightsData,
  InsightsPeriod
} from '../../../shared/types'
import { PanelSkeleton, StatCardsSkeleton } from '../components/Skeleton'
import { failed as toastOnError } from '../errors'
import { APP_NAME } from '../../../shared/app'

/** ?compare=1,3 — up to 3 chapter ids for the side-by-side comparison. */
function compareFromParams(params: URLSearchParams): number[] {
  const ids = (params.get('compare') ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
  return [...new Set(ids)].slice(0, MAX_COMPARE)
}

function Insights(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const period = periodFromParams(params)
  const { insights, feelings, loading, failed } = useInsights(period)
  const [analyses, setAnalyses] = useState<ChapterAnalysis[]>([])
  const chapters = analyses.map((analysis) => analysis.chapter)
  const setPeriod = (next: InsightsPeriod): void => {
    const nextParams = periodParams(next, params)
    nextParams.delete('section')
    setParams(nextParams, { replace: true })
  }
  const setCompare = (ids: number[]): void => {
    const next = new URLSearchParams(params)
    if (ids.length) next.set('compare', ids.join(','))
    else next.delete('compare')
    next.delete('section')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    void window.api.stats
      .chapters()
      .then(setAnalyses)
      .catch((error: unknown) => {
        setAnalyses([])
        toastOnError('Couldn’t load your life chapters.')(error)
      })
  }, [])

  const chaptersSection =
    analyses.length > 0 ? (
      <div className="mt-6">
        <ChaptersSection
          analyses={analyses}
          compare={compareFromParams(params)}
          onCompareChange={setCompare}
          onViewChapter={(chapterId) => {
            setPeriod({ kind: 'chapter', chapterId })
            window.scrollTo({ top: 0 })
          }}
          focus={params.get('section') === 'chapters'}
        />
      </div>
    ) : null

  return (
    <div className="page-wide">
      <PageTitle
        description="What you watched, why you watched it, and how it made you feel."
        action={<PeriodSelector value={period} onChange={setPeriod} chapters={chapters} />}
      >
        Insights
      </PageTitle>
      {failed ? (
        <EmptyState
          icon={BarChart3}
          title="Couldn't load your insights"
          description={`Something went wrong while reading your diary. Try switching the period or restarting ${APP_NAME}.`}
        />
      ) : !insights ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={6} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
          <div className="grid gap-6 lg:grid-cols-2">
            <PanelSkeleton height="h-64" />
            <PanelSkeleton height="h-64" />
          </div>
        </div>
      ) : !insights.hasAnyWatches ? (
        <EmptyState
          icon={BarChart3}
          title="Your insights will appear here"
          description={`Log a watch with your mood before and after, and ${APP_NAME} will start showing your patterns.`}
          action={
            <Link to="/add" className="btn btn-primary">
              Add a title
            </Link>
          }
        />
      ) : insights.totals.watches === 0 && insights.totals.episodes === 0 ? (
        <>
          <EmptyState
            icon={CalendarRange}
            title={`Nothing watched ${periodPhrase(period, chapters)}`}
            description="Pick a longer period to see your patterns."
            action={
              <button type="button" onClick={() => setPeriod('all')} className="btn btn-primary">
                Show all time
              </button>
            }
          />
          {chaptersSection}
        </>
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <Totals insights={insights} />
          <div className="grid gap-6 lg:grid-cols-3">
            <WatchesPanel insights={insights} feelings={feelings} period={period} />
            <SectionPanel title="Top genres" action={<PanelNote>By watches</PanelNote>}>
              <GenreDonutChart genres={insights.genres} />
            </SectionPanel>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <SectionPanel
              title="Mood before vs after"
              className="lg:col-span-2"
              action={<PanelNote>By genre</PanelNote>}
            >
              <MoodByGenreChart groups={insights.moodByGenre.items} />
            </SectionPanel>
            <MoodOverview mood={insights.mood} />
          </div>
          {feelings ? <FeelingsSection feelings={feelings} period={period} /> : null}
          <MoodInsights insights={insights} />
          {chaptersSection}
        </div>
      )}
    </div>
  )
}

/**
 * "This month" keeps the last 12 months for context; every other period charts its own range,
 * per month, or per year when it's longer than 24 months.
 */
function WatchesPanel({
  insights,
  feelings,
  period
}: {
  insights: InsightsData
  feelings: FeelingsAnalysis | null
  period: InsightsPeriod
}): React.JSX.Element {
  if (period === 'month' || !feelings) {
    return (
      <SectionPanel
        title="Watches per month"
        className="lg:col-span-2"
        action={<PanelNote>Last 12 months</PanelNote>}
      >
        <WatchesPerMonthChart data={insights.watchesPerMonth} />
      </SectionPanel>
    )
  }
  const { bucket, items } = feelings.watchesOverTime
  return (
    <SectionPanel
      title={bucket === 'year' ? 'Watches per year' : 'Watches per month'}
      className="lg:col-span-2"
      action={<PanelNote>This period</PanelNote>}
    >
      <WatchesPerMonthChart
        data={items.map((item) => ({ month: item.key, movies: item.movies, series: item.series }))}
        bucket={bucket}
        emptyText="No finished watches in this period."
      />
    </SectionPanel>
  )
}

function Totals({ insights }: { insights: InsightsData }): React.JSX.Element {
  const { totals } = insights
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard icon={Clapperboard} label="Movies watched" value={totals.movies} />
      <StatCard icon={Tv} label="Series watched" value={totals.series} tone="blue" />
      <StatCard icon={Ticket} label="Watches" value={totals.watches} trend="Including rewatches" />
      <StatCard
        icon={ListVideo}
        label="Episodes watched"
        value={totals.episodes}
        tone="blue"
        trend="Including series in progress"
      />
      <StatCard
        icon={Clock}
        label="Hours watched"
        value={totals.hours}
        format={(hours) => (hours < 10 ? hours.toFixed(1) : Math.round(hours).toLocaleString())}
      />
      <StatCard
        icon={Star}
        label="Average rating"
        value={totals.averageRating}
        format={(rating) => rating.toFixed(1)}
        tone="rating"
        trend={
          totals.ratedTitles
            ? `Across ${totals.ratedTitles} rated ${totals.ratedTitles === 1 ? 'title' : 'titles'}`
            : 'No rated titles yet'
        }
      />
    </div>
  )
}

function MoodOverview({ mood }: { mood: InsightsData['mood'] }): React.JSX.Element {
  const change = mood.change.average
  return (
    <SectionPanel title="Mood overview">
      {mood.before.n === 0 && mood.after.n === 0 ? (
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          No mood scores yet. Rate how you feel before and after a watch to see this.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <MoodAverageValue
              label="Before watching"
              value={mood.before.average}
              n={mood.before.n}
            />
            <MoodAverageValue label="After watching" value={mood.after.average} n={mood.after.n} />
          </div>
          <div className="rounded-[var(--radius-card)] bg-[var(--color-panel-elevated)] p-4">
            <p className="text-[13px] text-[var(--color-text-muted)]">Average mood change</p>
            {change === null ? (
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Not enough data yet. Log both a before and after score on a watch.
              </p>
            ) : (
              <>
                <p
                  className="mt-1 text-3xl font-semibold tabular-nums"
                  style={{ color: changeColor(change) }}
                >
                  {formatChange(change)}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Based on {watchCount(mood.change.n)} with both scores
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </SectionPanel>
  )
}

function MoodAverageValue({
  label,
  value,
  n
}: {
  label: string
  value: number | null
  n: number
}): React.JSX.Element {
  return (
    <div>
      <p className="text-[13px] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
        {value === null ? '–' : value.toFixed(1)}
        <span className="text-sm font-normal text-[var(--color-text-muted)]"> / 10</span>
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Based on {watchCount(n)}</p>
    </div>
  )
}

function MoodInsights({ insights }: { insights: InsightsData }): React.JSX.Element {
  const navigate = useNavigate()
  const openTitle = (titleId: number): void => {
    void navigate(`/title/${titleId}`)
  }
  const boosters = insights.topTitles.items.filter((item) => item.averageChange > 0)
  const effective = insights.effectiveFor.filter((reason) => reason.titles.enoughData)
  const waiting = insights.effectiveFor.filter((reason) => !reason.titles.enoughData)
  const topReasons = insights.topReasons.slice(0, 6)
  const maxReasonWatches = topReasons[0]?.watches ?? 0

  return (
    <section className="space-y-6 pt-2">
      <div>
        <SectionHeading>Mood insights</SectionHeading>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Mood change is your mood score after a watch minus before, on a 1–10 scale.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionPanel title="Biggest mood boosters">
          {!insights.topTitles.enoughData ? (
            <NotEnoughData />
          ) : boosters.length === 0 ? (
            <p className="text-sm leading-6 text-[var(--color-text-muted)]">
              None of your titles has lifted your mood yet in this period.
            </p>
          ) : (
            <div className="-mx-2 space-y-1">
              {boosters.map((item) => (
                <MoodTitleRow
                  key={item.titleId}
                  item={item}
                  onClick={() => openTitle(item.titleId)}
                />
              ))}
            </div>
          )}
          {insights.topTitles.enoughData ? <BasedOn n={insights.topTitles.n} /> : null}
        </SectionPanel>

        <SectionPanel title="Mood change by reason">
          {!insights.moodByReason.enoughData ? (
            <NotEnoughData>
              Each reason needs at least 2 watches with a mood before and after.
            </NotEnoughData>
          ) : (
            <ul className="space-y-3">
              {insights.moodByReason.items.map((group) => {
                const Icon = group.averageChange < 0 ? TrendingDown : TrendingUp
                return (
                  <li key={group.reasonKey} className="flex gap-3 text-sm leading-6">
                    <Icon
                      size={18}
                      className="mt-0.5 shrink-0"
                      style={{ color: changeColor(group.averageChange) }}
                    />
                    <span className="text-[var(--color-text-secondary)]">
                      {reasonChangeSentence(group)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionPanel>
      </div>

      <SectionPanel title="Most effective for">
        {effective.length === 0 ? (
          <NotEnoughData>
            Tag your watches with reasons like Stressed or Needed motivation, and log your mood
            before and after.
          </NotEnoughData>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {effective.map((reason) => (
              <article
                key={reason.reasonKey}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-background)]/40 p-4"
              >
                <span className="rounded-full bg-[var(--color-accent-muted)] px-3 py-1 text-xs text-[var(--color-accent-light)]">
                  {reason.label}
                </span>
                {reason.bestGenre ? (
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {bestGenreSentence(reason.reasonKey, reason.label, reason.bestGenre)}{' '}
                    <span className="text-[var(--color-text-muted)]">
                      (based on {watchCount(reason.bestGenre.n)})
                    </span>
                  </p>
                ) : null}
                <div className="-mx-2 mt-3 space-y-1">
                  {reason.titles.items.map((item) => (
                    <MoodTitleRow
                      key={item.titleId}
                      item={item}
                      onClick={() => openTitle(item.titleId)}
                    />
                  ))}
                </div>
                <BasedOn n={reason.titles.n} />
              </article>
            ))}
          </div>
        )}
        {effective.length > 0 && waiting.length > 0 ? (
          <p className="mt-4 text-xs leading-5 text-[var(--color-text-muted)]">
            Not enough data yet for {waiting.map((reason) => reason.label).join(', ')}.
          </p>
        ) : null}
      </SectionPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionPanel title="Why you watch">
          {topReasons.length === 0 ? (
            <p className="text-sm leading-6 text-[var(--color-text-muted)]">
              No reasons logged yet. Add a reason when you log a watch to see what draws you in.
            </p>
          ) : (
            <ul className="space-y-3">
              {topReasons.map((reason) => (
                <li
                  key={reason.reasonKey}
                  className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-4 text-sm"
                >
                  <span className="truncate text-[var(--color-text-secondary)]">
                    {reason.label}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-[var(--color-panel-elevated)]">
                    <span
                      className="block h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${(reason.watches / maxReasonWatches) * 100}%` }}
                    />
                  </span>
                  <span className="w-16 text-right text-xs tabular-nums text-[var(--color-text-muted)]">
                    {watchCount(reason.watches)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
        <TopDirectors directors={insights.topDirectors} />
      </div>
    </section>
  )
}

/** Directors of the movies you watched in the period (from TMDB credits). */
function TopDirectors({
  directors
}: {
  directors: InsightsData['topDirectors']
}): React.JSX.Element {
  const max = directors.items[0]?.watches ?? 0
  return (
    <SectionPanel title="Top directors">
      {directors.items.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          No directors yet. Movies added or linked through TMDB bring their director along.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {directors.items.map((director) => (
              <li
                key={director.name}
                className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-4 text-sm"
              >
                <span className="truncate text-[var(--color-text-secondary)]">{director.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[var(--color-panel-elevated)]">
                  <span
                    className="block h-full rounded-full bg-[var(--color-accent-blue)]"
                    style={{ width: `${(director.watches / max) * 100}%` }}
                  />
                </span>
                <span className="w-28 text-right text-xs tabular-nums text-[var(--color-text-muted)]">
                  {watchCount(director.watches)}
                  {director.titles > 1 ? ` · ${director.titles} films` : ''}
                </span>
              </li>
            ))}
          </ul>
          <BasedOn n={directors.n} />
        </>
      )}
    </SectionPanel>
  )
}

function NotEnoughData({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-5 text-sm leading-6">
      <p className="font-semibold text-[var(--color-text-secondary)]">Not enough data yet</p>
      <p className="mt-1 text-[var(--color-text-muted)]">
        {children ?? 'This needs at least 2 watches with a mood before and after.'}
      </p>
    </div>
  )
}

function BasedOn({ n }: { n: number }): React.JSX.Element {
  return <p className="mt-3 text-xs text-[var(--color-text-muted)]">Based on {watchCount(n)}</p>
}

function PanelNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="text-xs text-[var(--color-text-muted)]">{children}</span>
}

export default Insights
