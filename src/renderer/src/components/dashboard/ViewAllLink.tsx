import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function ViewAllLink({ to }: { to: string }): React.JSX.Element {
  return (
    <Link to={to} className="link shrink-0">
      View all <ArrowRight size={14} />
    </Link>
  )
}

export default ViewAllLink
