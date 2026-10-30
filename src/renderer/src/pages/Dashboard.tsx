import { Clapperboard, Home, ListVideo, Plus, Smile, Star, Tv } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PosterCard from '../components/PosterCard'
import SectionPanel from '../components/SectionPanel'
import { PanelSkeleton, Skeleton, SkeletonGroup, StatCardsSkeleton } from '../components/Skeleton'
import StatCard from '../components/StatCard'
import GenreDonutChart from '../components/charts/GenreDonutChart'
import LanguagesChart from '../components/charts/LanguagesChart'
import MoodTrendChart from '../components/charts/MoodTrendChart'
import FavoritesCarousel from '../components/dashboard/FavoritesCarousel'
import BackupReminder from '../components/dashboard/BackupReminder'
import HeroBanner from '../components/dashboard/HeroBanner'
import MemoryCard from '../components/dashboard/MemoryCard'
import MiniTimeline from '../components/dashboard/MiniTimeline'
import PosterShelf from '../components/dashboard/PosterShelf'
import ViewAllLink from '../components/dashboard/ViewAllLink'
import WelcomeState from '../components/dashboard/WelcomeState'
import WhatToWatch from '../components/dashboard/WhatToWatch'
import { changeColor, formatChange, watchCount } from '../components/insightSentences'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { useSettings } from '../hooks/useSettings'
import type { CurrentWatch, DashboardData, Insights, LanguageStats } from '../../../shared/types'
import { formatShortDay, formatWatchDate } from '../format'
import { logError } from '../errors'
import { APP_NAME } from '../../../shared/app'

interface HomeData {
  dashboard: DashboardData
  allTime: Insights
  thisMonth: Insights
  languages: LanguageStats
}

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Staggers the fade-in of each section a little (use with the animate-fade-up class). */
function fadeDelay(index: number): React.CSSProperties {
  return { animationDelay: `${index * 50}ms` }
}

function Dashboard(): React.JSX.Element | null {
  const navigate = useNavigate()
  const settings = useSettings()
  const quickAdd = useQuickAdd()
  const [data, setData] = useState<HomeData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void Promise.all([
      window.api.dashboard.get(),
      window.api.stats.insights('all'),
      window.api.stats.insights('month'),
      window.api.stats.languages('all')
    ])
      .then(([dashboard, allTime, thisMonth, languages]) =>
        setData({ dashboard, allTime, thisMonth, languages })
      )
      .catch((error: unknown) => {
        logError('renderer', error)
        setFailed(true)
      })
  }, [])

  if (failed) {
    return (
      <EmptyState
        icon={Home}
        title="Couldn't load your dashboard"
        description={`Something went wrong while reading your diary. Try restarting ${APP_NAME}.`}
      />
    )
  }
  if (!data || !settings) return <DashboardSkeleton />

  const name = settings.displayName
  const greeting = `${greetingFor(new Date().getHours())}${name ? `, ${name}` : ''}`
  const openTitle = (id: number): void => {
    void navigate(`/title/${id}`)
  }

  if (!data.dashboard.hasTitles) {
    return (
      <div className="page-wide">
        <WelcomeState
          greeting={greeting}
          bannerFile={settings.bannerFile}
          hasName={Boolean(name)}
        />
      </div>
    )
  }

  const { dashboard, allTime, thisMonth, languages } = data
  const watchesThisMonth = thisMonth.totals.watches

  return (
    <div className="page-wide space-y-6">
      <div className="animate-fade-up">
        <HeroBanner
          greeting={greeting}
          subtitle={
            watchesThisMonth > 0
              ? `You've finished ${watchCount(watchesThisMonth)} this month. What will you watch next?`
              : 'Another day, another great story. What will you watch next?'
          }
          bannerFile={settings.bannerFile}
        >
          <button
            type="button"
            onClick={quickAdd}
            title="Quick add (Ctrl+N)"
            className="btn btn-primary shadow-[var(--shadow-poster)]"
          >
            <Plus size={18} /> Quick add
          </button>
        </HeroBanner>
      </div>

      <BackupReminder />

      <div
        className="animate-fade-up grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        style={fadeDelay(1)}
      >
        <StatCard
          icon={Clapperboard}
          label="Total movies"
          value={allTime.totals.movies}
          trend={<MonthTrend value={dashboard.newThisMonth.movies} />}
        />
        <StatCard
          icon={Tv}
          label="Total TV series"
          value={allTime.totals.series}
          tone="blue"
          trend={<MonthTrend value={dashboard.newThisMonth.series} />}
        />
        <StatCard
          icon={ListVideo}
          label="Total episodes"
          value={allTime.totals.episodes}
          tone="positive"
          trend={<MonthTrend value={thisMonth.totals.episodes} />}
        />
        <StatCard
          icon={Star}
          label="Average rating"
          value={allTime.totals.averageRating}
          format={(rating) => rating.toFixed(1)}
          tone="rating"
          trend={<RatingTrend change={dashboard.ratingChangeThisMonth} />}
        />
      </div>

      <div
        className="animate-fade-up grid gap-6 md:grid-cols-2 2xl:grid-cols-[1.1fr_0.8fr_1.4fr]"
        style={fadeDelay(2)}
      >
        {/* Two columns: genres on the left, mood summary above the trend on the right. */}
        <SectionPanel title="Favorite genres" className="md:row-span-2 2xl:row-span-1">
          <GenreDonutChart genres={allTime.genres} />
        </SectionPanel>
        <MoodSummary mood={allTime.mood} />
        <SectionPanel title="Mood overview" action={<ViewAllLink to="/insights" />}>
          <MoodTrendChart points={dashboard.moodTrend} />
        </SectionPanel>
      </div>

      <div className="animate-fade-up" style={fadeDelay(3)}>
        <SectionPanel title="Languages" action={<ViewAllLink to="/insights" />}>
          <LanguagesChart languages={languages} />
        </SectionPanel>
      </div>

      <div
        className="animate-fade-up grid gap-6 lg:grid-cols-2 2xl:grid-cols-[1.3fr_1fr_1fr]"
        style={fadeDelay(4)}
      >
        <PosterShelf
          title="Recently watched"
          className="lg:col-span-2 2xl:col-span-1"
          viewAllTo="/journal"
          empty="Finish a watch and it will show up here."
        >
          {dashboard.recentlyWatched.map((watch) => (
            <PosterCard
              key={watch.title.id}
              title={watch.title}
              meta={<span>{formatWatchDate(watch.completedAt, watch.datePrecision, true)}</span>}
              onClick={() => openTitle(watch.title.id)}
            />
          ))}
        </PosterShelf>
        <PosterShelf
          title="Currently watching"
          viewAllTo="/collection?status=watching"
          empty="Start watching something from your collection to track it here."
        >
          {dashboard.currentlyWatching.map((watch) => (
            <PosterCard
              key={watch.title.id}
              title={watch.title}
              meta={<span>{progressLabel(watch)}</span>}
              footer={<ProgressBar watch={watch} />}
              onClick={() => openTitle(watch.title.id)}
            />
          ))}
        </PosterShelf>
        <PosterShelf
          title="Recently added"
          viewAllTo="/collection?sort=recent"
          empty="Titles you add will appear here."
        >
          {dashboard.recentlyAdded.map((title) => (
            <PosterCard key={title.id} title={title} onClick={() => openTitle(title.id)} />
          ))}
        </PosterShelf>
      </div>

      <div className="animate-fade-up grid gap-6 2xl:grid-cols-[1.6fr_1fr]" style={fadeDelay(5)}>
        <WhatToWatch />
        <FavoritesCarousel favorites={dashboard.favorites} />
      </div>

      <div className="animate-fade-up grid gap-6 2xl:grid-cols-[1.6fr_1fr]" style={fadeDelay(6)}>
        <MiniTimeline items={dashboard.timeline} />
        <MemoryCard memory={dashboard.memory} />
      </div>
    </div>
  )
}

function MonthTrend({ value }: { value: number }): React.JSX.Element {
  if (value <= 0) return <>None this month</>
  return (
    <>
      <span className="font-semibold text-[var(--color-positive)]">+{value.toLocaleString()}</span>{' '}
      this month
    </>
  )
}

function RatingTrend({ change }: { change: number | null }): React.JSX.Element {
  if (change === null) return <>No change yet</>
  if (Math.round(change * 10) === 0) return <>No change this month</>
  return (
    <>
      <span
        className="font-semibold"
        style={{ color: change > 0 ? changeColor(change) : undefined }}
      >
        {formatChange(change)}
      </span>{' '}
      this month
    </>
  )
}

function MoodSummary({ mood }: { mood: Insights['mood'] }): React.JSX.Element {
  const after = mood.after.average
  const change = mood.change.average
  return (
    <SectionPanel title="Mood after watching" className="flex flex-col">
      {after === null ? (
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          Rate your mood after a watch and your average will appear here.
        </p>
      ) : (
        <div className="flex flex-1 items-center gap-5 pb-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-positive)]/15 text-[var(--color-positive)]">
            <Smile size={32} />
          </span>
          <div>
            <p className="text-3xl font-semibold leading-none tabular-nums text-[var(--color-text-primary)]">
              {after.toFixed(1)}
              <span className="text-base font-normal text-[var(--color-text-muted)]"> / 10</span>
            </p>
            {change !== null ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                <span className="font-semibold" style={{ color: changeColor(change) }}>
                  {formatChange(change)}
                </span>{' '}
                average mood change
              </p>
            ) : null}
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Based on {watchCount(mood.after.n)}
            </p>
          </div>
        </div>
      )}
    </SectionPanel>
  )
}

/** The Home layout in grey while the numbers load. */
function DashboardSkeleton(): React.JSX.Element {
  return (
    <SkeletonGroup label="Loading your dashboard" className="page-wide space-y-6">
      <Skeleton className="h-56 w-full rounded-[var(--radius-panel)]" />
      <StatCardsSkeleton className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" />
      <div className="grid gap-6 md:grid-cols-2">
        <PanelSkeleton height="h-64" />
        <PanelSkeleton height="h-64" />
      </div>
      <PanelSkeleton height="h-56" />
    </SkeletonGroup>
  )
}

function progressLabel(watch: CurrentWatch): string {
  if (watch.title.type === 'series') {
    const total = watch.title.totalEpisodes
    return `${watch.episodesWatched}${total ? ` / ${total}` : ''} eps${watch.isRewatch ? ' · rewatch' : ''}`
  }
  return `Started ${formatShortDay(watch.startedAt)}`
}

function ProgressBar({ watch }: { watch: CurrentWatch }): React.JSX.Element | null {
  const total = watch.title.totalEpisodes
  if (watch.title.type !== 'series' || !total) return null
  const percent = Math.min(100, (watch.episodesWatched / total) * 100)
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${watch.title.title} progress`}
      className="h-1.5 overflow-hidden rounded-full bg-[var(--color-panel-elevated)]"
    >
      <div
        className="h-full rounded-full bg-[var(--color-accent)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export default Dashboard
