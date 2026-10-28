interface ReasonChipProps {
  label: string
  selected?: boolean
  onClick?: () => void
}

/** A reason pill: a toggle button when it has onClick, plain text otherwise. */
function ReasonChip({ label, selected = false, onClick }: ReasonChipProps): React.JSX.Element {
  if (!onClick) return <span className="chip">{label}</span>
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="chip">
      {label}
    </button>
  )
}

export default ReasonChip
