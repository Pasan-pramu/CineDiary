import SectionPanel from '../SectionPanel'
import ViewAllLink from './ViewAllLink'

interface PosterShelfProps {
  title: string
  viewAllTo: string
  /** Shown instead of the posters when there's nothing to show yet. */
  empty: string
  className?: string
  children: React.ReactNode[]
}

/**
 * A panel with a single row of posters. The row shows as many posters as fit the panel's
 * width; the rest are hidden (zero-height extra grid rows) rather than wrapping.
 */
function PosterShelf({
  title,
  viewAllTo,
  empty,
  className,
  children
}: PosterShelfProps): React.JSX.Element {
  return (
    <SectionPanel title={title} className={className} action={<ViewAllLink to={viewAllTo} />}>
      {children.length === 0 ? (
        <p className="flex min-h-40 items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] px-6 text-center text-sm leading-6 text-[var(--color-text-muted)]">
          {empty}
        </p>
      ) : (
        <div className="-mt-1 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-4 overflow-hidden pt-1 [grid-auto-rows:0] [grid-template-rows:auto]">
          {children}
        </div>
      )}
    </SectionPanel>
  )
}

export default PosterShelf
