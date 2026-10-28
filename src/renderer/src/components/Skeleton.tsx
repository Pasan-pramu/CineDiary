// Loading placeholders shaped like the content they stand in for (instead of spinners).
// Each group fades in after 150ms (see .skeleton-group), so a quick load never flashes.

interface SkeletonProps {
  className?: string
}

/** One grey block; size it with classes. */
export function Skeleton({ className = '' }: SkeletonProps): React.JSX.Element {
  return <div className={`skeleton ${className}`} />
}

/** Wraps a loading layout and tells screen readers what is happening. */
export function SkeletonGroup({
  children,
  label = 'Loading',
  className = ''
}: {
  children: React.ReactNode
  label?: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={`skeleton-group ${className}`}
    >
      {children}
    </div>
  )
}

/** Poster cards: a 2:3 poster, a title line and a meta line. */
export function PosterGridSkeleton({
  count = 12,
  className = 'poster-grid'
}: {
  count?: number
  className?: string
}): React.JSX.Element {
  return (
    <SkeletonGroup label="Loading titles" className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[2/3] w-full rounded-[var(--radius-card)]" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** Rows with a small poster and two lines (lists, journal entries). */
export function ListSkeleton({
  rows = 5,
  label = 'Loading'
}: {
  rows?: number
  label?: string
}): React.JSX.Element {
  return (
    <SkeletonGroup label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="panel flex items-center gap-4 p-4">
          <Skeleton className="aspect-[2/3] w-12 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** A row of stat cards. */
export function StatCardsSkeleton({
  count = 4,
  className = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'
}: {
  count?: number
  className?: string
}): React.JSX.Element {
  return (
    <SkeletonGroup label="Loading numbers" className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="panel flex items-start gap-4 p-5">
          <Skeleton className="size-11 shrink-0 rounded-[var(--radius-card)]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** A panel with a heading line and a body block of the given height class. */
export function PanelSkeleton({ height = 'h-48' }: { height?: string }): React.JSX.Element {
  return (
    <div className="panel p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className={`mt-5 w-full ${height}`} />
    </div>
  )
}
