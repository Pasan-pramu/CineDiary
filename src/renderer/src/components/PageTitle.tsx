interface PageTitleProps {
  children: React.ReactNode
  description?: string
  /** Controls shown on the right of the title, e.g. a period selector. */
  action?: React.ReactNode
}

function PageTitle({ children, description, action }: PageTitleProps): React.JSX.Element {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title text-[var(--color-text-primary)]">{children}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  )
}

export default PageTitle
