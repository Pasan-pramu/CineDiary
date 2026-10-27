import { useOnlineStatus } from '../hooks/useOnlineStatus'

/** Small status pill for the top bar. Offline only turns off TMDB features. */
function OnlineBadge(): React.JSX.Element {
  const online = useOnlineStatus()
  return (
    <span
      role="status"
      title={
        online
          ? 'Online — TMDB search is available'
          : 'Offline — everything works except TMDB search'
      }
      className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] sm:flex"
    >
      <span
        className={`size-2 rounded-full ${online ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-text-muted)]'}`}
      />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}

export default OnlineBadge
