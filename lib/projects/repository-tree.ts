import type { BackendFileTree } from '@/lib/backend/client'
import { buildFileTree } from '@/lib/projects/utils'
import type { FileNode } from '@/lib/projects/types'

/** Presentation data for the backend handoff; not a claim about the current API response. */
export interface RepositoryCommit {
  sha: string
  message: string
  committedAt: string
}

export interface RepositoryNode extends Record<string, unknown> {
  id: string
  name: string
  kind: 'file' | 'folder'
  size: number
  fileCount: number
  lastCommit: RepositoryCommit | null
  children?: RepositoryNode[]
}

/** Build folder totals from the listed files, including after search prunes them. */
export function buildRepositoryTree(files: BackendFileTree['files'], query = '', commits?: ReadonlyMap<string, RepositoryCommit | null>): RepositoryNode[] {
  const search = query.trim().toLocaleLowerCase()
  const matching = files.filter((file) => file.path.toLocaleLowerCase().includes(search))
  const sizes = new Map(matching.map((file) => [file.path, file.size]))
  const convert = (node: FileNode): RepositoryNode => {
    const children = node.children?.map(convert)
    const lastCommit = children
      ? children.reduce<RepositoryCommit | null>((latest, child) => child.lastCommit && (!latest || Date.parse(child.lastCommit.committedAt) > Date.parse(latest.committedAt)) ? child.lastCommit : latest, null)
      : commits?.get(node.path) ?? null
    return {
      id: node.path, name: node.name, kind: node.type,
      size: children ? children.reduce((total, child) => total + child.size, 0) : sizes.get(node.path)!,
      fileCount: children ? children.reduce((total, child) => total + child.fileCount, 0) : 1,
      lastCommit,
      ...(children ? { children } : {}),
    }
  }
  return buildFileTree(matching.map((file) => ({ path: file.path, content: '' }))).map(convert)
}

export function repositoryFolderIds(nodes: RepositoryNode[]): Set<string> {
  return new Set(nodes.flatMap((node) => node.children ? [node.id, ...repositoryFolderIds(node.children)] : []))
}

export function formatRepositorySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length)
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1024 ** exponent)} ${units[exponent - 1]}`
}

export function formatRepositoryCommitDate(iso: string, now: number): string {
  const seconds = (Date.parse(iso) - now) / 1000
  const units = [
    ['year', 365 * 24 * 60 * 60], ['month', 30 * 24 * 60 * 60], ['day', 24 * 60 * 60], ['hour', 60 * 60], ['minute', 60], ['second', 1],
  ] as const
  const [unit, scale] = units.find(([, length]) => Math.abs(seconds) >= length) ?? units[units.length - 1]
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / scale), unit)
}
