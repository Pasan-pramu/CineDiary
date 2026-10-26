interface PageTitleProps {
  children: React.ReactNode
  description?: string
}

function PageTitle({ children, description }: PageTitleProps): React.JSX.Element {
  return (
    <header className="mb-8">
      <h1 className="page-title text-[var(--color-text-primary)]">{children}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
          {description}
        </p>
      ) : null}
    </header>
  )
}

export default PageTitle
