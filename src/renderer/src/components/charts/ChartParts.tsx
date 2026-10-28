// Small building blocks shared by the Recharts charts. These are plain HTML, so they can
// use the CSS variables directly.

export function ChartLegend({
  items
}: {
  items: { label: string; color: string }[]
}): React.JSX.Element {
  return (
    <ul className="mb-3 flex flex-wrap gap-4 text-xs text-[var(--color-text-secondary)]">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function ChartTooltip({
  title,
  rows,
  footer
}: {
  title: string
  rows: { label: string; value: string; color?: string }[]
  footer?: string
}): React.JSX.Element {
  return (
    <div className="min-w-40 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)] px-3 py-2 text-xs shadow-[var(--shadow-poster)]">
      <p className="mb-1.5 font-semibold text-[var(--color-text-primary)]">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2 py-0.5">
          {row.color ? (
            <span className="size-2 rounded-full" style={{ background: row.color }} />
          ) : null}
          <span className="text-[var(--color-text-muted)]">{row.label}</span>
          <span className="ml-auto pl-4 font-semibold tabular-nums text-[var(--color-text-primary)]">
            {row.value}
          </span>
        </p>
      ))}
      {footer ? <p className="mt-1.5 text-[var(--color-text-muted)]">{footer}</p> : null}
    </div>
  )
}

export function ChartEmpty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-56 items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] px-6 text-center text-sm leading-6 text-[var(--color-text-muted)]">
      {children}
    </div>
  )
}
