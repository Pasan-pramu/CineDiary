interface ReasonChipProps {
  label: string
  selected?: boolean
  onClick?: () => void
}

function ReasonChip({ label, selected = false, onClick }: ReasonChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${selected ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-light)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'}`}
    >
      {label}
    </button>
  )
}

export default ReasonChip
