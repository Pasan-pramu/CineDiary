import type { LucideIcon } from 'lucide-react'

interface PagePlaceholderProps {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
}

function PagePlaceholder({
  eyebrow,
  title,
  description,
  icon: Icon
}: PagePlaceholderProps): React.JSX.Element {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-5xl items-center justify-center">
      <div className="w-full rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center shadow-2xl shadow-black/10 sm:p-14">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[var(--color-accent-muted)] text-[var(--color-accent-light)]">
          <Icon size={28} />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-light)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
    </section>
  )
}

export default PagePlaceholder
