import { User } from 'lucide-react'

interface UserAvatarProps {
  name: string | null | undefined
  className?: string
}

/** The display name's first letter, or a person icon when no name is set. */
function UserAvatar({ name, className = '' }: UserAvatarProps): React.JSX.Element {
  const initial = name?.trim().charAt(0).toUpperCase()
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-muted)] font-semibold text-[var(--color-accent-light)] ${className}`}
    >
      {initial || <User size={16} />}
    </div>
  )
}

export default UserAvatar
