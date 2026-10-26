import type { LucideIcon } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import PageTitle from '../components/PageTitle'

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
    <div className="mx-auto max-w-5xl">
      <PageTitle description={eyebrow}>{title}</PageTitle>
      <EmptyState icon={Icon} title="Coming soon" description={description} />
    </div>
  )
}

export default PagePlaceholder
