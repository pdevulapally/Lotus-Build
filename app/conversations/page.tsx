import { notFound } from 'next/navigation'
import { PrivateConversations } from '@/components/project/private-conversations'

export const metadata = {title: 'Private conversations', robots: {index: false, follow: false}}

export default function ConversationsPage() {
  if (process.env.NEXT_PUBLIC_PRIVATE_CONVERSATIONS !== 'true') notFound()
  return <PrivateConversations />
}
