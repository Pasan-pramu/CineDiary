import SectionHeading from './SectionHeading'

interface SectionPanelProps {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

function SectionPanel({
  title,
  children,
  action,
  className = ''
}: SectionPanelProps): React.JSX.Element {
  return (
    <section
      className={`min-w-0 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionHeading>{title}</SectionHeading>
        {action}
      </div>
      {children}
    </section>
  )
}

export default SectionPanel
