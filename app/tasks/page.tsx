export const metadata = { title: 'Workspace · LotusBuild', robots: { index: false, follow: false } }
import { Suspense } from 'react'
import { TaskWorkspace } from '@/components/tasks/task-workspace'
export default function TasksPage() {
  return <Suspense fallback={<p role="status">Opening workspace…</p>}><TaskWorkspace /></Suspense>
}
