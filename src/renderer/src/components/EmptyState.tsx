import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-accent-muted)] text-[var(--color-accent-light)]">
        <Icon size={25} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-text-muted)]">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export default EmptyState
