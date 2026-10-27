import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function ViewAllLink({ to }: { to: string }): React.JSX.Element {
  return (
    <Link
      to={to}
      className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)] transition hover:text-[var(--color-accent-light)]"
    >
      View all <ArrowRight size={14} />
    </Link>
  )
}

export default ViewAllLink
