'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import styles from './profile-avatar.module.css'

export function ProfileAvatar({ name, email, photoURL, className }: {
  name?: string | null
  email?: string | null
  photoURL?: string | null
  className?: string
}) {
  const initial = Array.from(name?.trim() || email?.trim() || '?')[0].toUpperCase()

  return <Avatar className={cn('size-14 text-xl font-semibold', className)} aria-hidden="true">
    <AvatarImage src={photoURL?.trim() || undefined} alt="" referrerPolicy="no-referrer" className="object-cover" />
    <AvatarFallback className={styles.fallback}>
      <span className="relative z-10">{initial}</span>
    </AvatarFallback>
  </Avatar>
}
