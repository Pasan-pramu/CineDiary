interface SectionHeadingProps {
  children: React.ReactNode
}

function SectionHeading({ children }: SectionHeadingProps): React.JSX.Element {
  return <h2 className="section-heading text-[var(--color-text-primary)]">{children}</h2>
}

export default SectionHeading
