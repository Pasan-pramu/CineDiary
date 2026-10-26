interface MoodChangeProps {
  before?: number | null
  after?: number | null
}

function MoodChange({ before, after }: MoodChangeProps): React.JSX.Element | null {
  if (before === null || before === undefined || after === null || after === undefined) return null
  const difference = after - before
  const color =
    difference > 0
      ? 'var(--color-positive)'
      : difference < 0
        ? 'var(--color-favorite)'
        : 'var(--color-text-muted)'
  return (
    <span style={{ color }} className="text-sm font-semibold">
      {before} → {after}
    </span>
  )
}

export default MoodChange
