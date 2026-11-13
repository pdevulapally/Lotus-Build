"use client"

import { useId, useMemo, useState, type ReactNode } from 'react'
import { File, Folder, FolderOpen, Search } from 'lucide-react'
import { Card } from '@astryxdesign/core/Card'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { Table, proportional, useTableTreeState, useTableTreeData, useTableSortableState, useTableSortable, useTableColumnResize, type TableColumn, type TablePlugin } from '@astryxdesign/core/Table'
import type { BackendFileTree } from '@/lib/backend/client'
import { buildRepositoryTree, repositoryFolderIds, formatRepositoryCommitDate, type RepositoryNode, type RepositoryCommit } from '@/lib/projects/repository-tree'
import { cn } from '@/lib/utils'

export function RepositoryTable({ files, selectedPath, onSelect, branchControl, branchCount, onBrowseBranches, commits, tags, onSelectTag }: {
  files: BackendFileTree['files']
  selectedPath: string | null
  onSelect: (path: string) => void
  branchControl?: ReactNode
  branchCount?: number
  onBrowseBranches?: () => void
  commits?: ReadonlyMap<string, RepositoryCommit | null>
  tags?: readonly string[]
  onSelectTag?: (tag: string) => void
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [cursor, setCursor] = useState<string | null>(null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const noticeId = useId()
  const nodes = useMemo(() => buildRepositoryTree(files, query, commits), [files, query, commits])
  const searching = query.trim().length > 0
  const searchExpanded = useMemo(() => repositoryFolderIds(nodes), [nodes])
  const { sortConfig, applySort } = useTableSortableState<RepositoryNode>({
    data: nodes,
    comparators: {
      name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
      commitMessage: (a, b) => (a.lastCommit?.message ?? '').localeCompare(b.lastCommit?.message ?? ''),
      commitDate: (a, b) => (a.lastCommit ? Date.parse(a.lastCommit.committedAt) : 0) - (b.lastCommit ? Date.parse(b.lastCommit.committedAt) : 0),
    },
  })
  const { visibleData, treeConfig } = useTableTreeState({
    data: nodes, idKey: 'id', expandedIds: searching ? searchExpanded : expanded,
    onExpandedIdsChange: searching ? () => {} : setExpanded,
    sortSiblings: applySort, treeColumnKey: 'name',
  })
  const tree = useTableTreeData({ ...treeConfig, hasExpandAllControl: !searching })
  const sort = useTableSortable<RepositoryNode>(sortConfig)
  const columns: TableColumn<RepositoryNode>[] = [
    { key: 'name', header: 'Name', width: proportional(2, { minWidth: 120 }), sortable: true, renderCell: (node) => {
      const Icon = node.kind === 'file' ? File : treeConfig.getRowMeta(node)?.isExpanded ? FolderOpen : Folder
      return <button type="button" title={node.id} aria-current={selectedPath === node.id ? 'true' : undefined}
        className="inline-flex min-w-0 items-center gap-2 rounded text-left text-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => node.kind === 'file' ? onSelect(node.id) : treeConfig.onToggleItem(node)}>
        <Icon aria-hidden fill={node.kind === 'folder' ? 'currentColor' : 'none'} className={cn('size-4 shrink-0', node.kind === 'folder' ? 'text-foreground' : 'text-muted-foreground')} /><span className="break-all">{node.name}</span>
      </button>
    } },
    { key: 'commitMessage', header: 'Last commit message', width: proportional(3, { minWidth: 140 }), sortable: commits !== undefined,
      renderCell: (node) => node.lastCommit ? <span title={node.lastCommit.message} className="text-muted-foreground">{node.lastCommit.message}</span> : <span aria-label={commits ? 'No commit details' : 'Commit details not connected'} className="text-muted-foreground">—</span> },
    { key: 'commitDate', header: 'Last commit date', width: proportional(1, { minWidth: 100 }), align: 'end', sortable: commits !== undefined,
      renderCell: (node) => node.lastCommit ? <time dateTime={node.lastCommit.committedAt} title={new Date(node.lastCommit.committedAt).toLocaleString()} className="text-muted-foreground">{formatRepositoryCommitDate(node.lastCommit.committedAt, Date.now())}</time> : <span aria-label={commits ? 'No commit details' : 'Commit details not connected'} className="text-muted-foreground">—</span> },
  ]
  const resize = useTableColumnResize<RepositoryNode>({ columnWidths, onColumnResizeEnd: (updates) => setColumnWidths((previous) => ({ ...previous, ...updates })) })
  const activeCursor = visibleData.some((node) => node.id === cursor) ? cursor : visibleData[0]?.id
  const keyboard: TablePlugin<RepositoryNode> = {
    transformTable: (props) => ({ ...props, htmlProps: { ...props.htmlProps, role: 'treegrid' } }),
    transformBodyRow: (props, node, index) => ({ ...props, htmlProps: {
      ...props.htmlProps,
      tabIndex: node.id === activeCursor ? 0 : -1,
      'aria-selected': node.id === selectedPath,
      'aria-level': (treeConfig.getRowMeta(node)?.level ?? 0) + 1,
      'aria-expanded': node.kind === 'folder' ? treeConfig.getRowMeta(node)?.isExpanded : undefined,
      className: cn(props.htmlProps.className, 'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2', node.id === selectedPath && 'bg-accent'),
      onFocus: (event) => { props.htmlProps.onFocus?.(event); setCursor(node.id) },
      onKeyDown: (event) => {
        props.htmlProps.onKeyDown?.(event)
        if (event.defaultPrevented || event.target !== event.currentTarget) return
        let destination: string | undefined
        const meta = treeConfig.getRowMeta(node)
        switch (event.key) {
          case 'ArrowDown': destination = visibleData[Math.min(index + 1, visibleData.length - 1)]?.id; break
          case 'ArrowUp': destination = visibleData[Math.max(index - 1, 0)]?.id; break
          case 'Home': destination = visibleData[0]?.id; break
          case 'End': destination = visibleData.at(-1)?.id; break
          case 'ArrowRight':
            if (meta?.hasChildren && !meta.isExpanded) treeConfig.onToggleItem(node)
            else if (meta?.hasChildren) destination = visibleData[index + 1]?.id
            break
          case 'ArrowLeft':
            if (meta?.hasChildren && meta.isExpanded && !searching) treeConfig.onToggleItem(node)
            else destination = node.id.slice(0, node.id.lastIndexOf('/'))
            break
          case 'Enter': case ' ':
            if (node.kind === 'file') onSelect(node.id)
            else treeConfig.onToggleItem(node)
            break
          default: return
        }
        event.preventDefault()
        if (destination) {
          const rows = event.currentTarget.closest('tbody')?.querySelectorAll<HTMLTableRowElement>('tr')
          const nextIndex = visibleData.findIndex((item) => item.id === destination)
          rows?.[nextIndex]?.focus()
        }
      },
    } }),
  }
  return <section aria-label="Repository files" className="min-w-0">
    <header className="flex flex-wrap items-center justify-between gap-3 pb-5">
      <section className="flex flex-wrap items-center gap-3">
        {branchControl}
        {branchCount !== undefined && <Button label={`${branchCount} ${branchCount === 1 ? 'Branch' : 'Branches'}`} size="sm" variant="ghost" onClick={onBrowseBranches} />}
        {tags && onSelectTag ? <DropdownMenu button={{ label: `${tags.length} Tags`, size: 'sm', variant: 'ghost' }} hasChevron items={tags.map((tag) => ({ id: tag, label: tag, onClick: () => onSelectTag(tag) }))} /> : <Button label="Tags" size="sm" variant="ghost" isDisabled tooltip="Tags are not connected yet." aria-describedby={noticeId} />}
      </section>
      <section className="flex min-w-0 flex-wrap items-center gap-2">
        <TextInput label="Go to file" isLabelHidden placeholder="Go to file" value={query} onChange={setQuery} startIcon={Search} hasClear size="sm" width="var(--container-3xs)" />
      </section>
    </header>
    {(commits === undefined || tags === undefined) && <p id={noticeId} className="mb-3 text-xs text-muted-foreground">{commits === undefined && tags === undefined ? 'Commit details and tags are not connected yet.' : commits === undefined ? 'Commit details are not connected yet.' : 'Tags are not connected yet.'}</p>}
    <Card padding={0} className="overflow-hidden"><Table aria-label="Repository files" data={visibleData} columns={columns} idKey="id" density="compact" dividers="none" isStriped hasHover textOverflow="truncate"
      emptyState={<section role="status" className="px-4 py-12 text-center text-sm text-muted-foreground">
        {files.length === 0 ? <><p className="font-medium text-foreground">No saved files yet</p><p className="mt-2">Your saved project files will appear here.</p></> : <><p>No files match “{query}”.</p><button type="button" onClick={() => setQuery('')} className="mt-3 rounded font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear search</button></>}
      </section>}
      plugins={{ tree, sort, resize, keyboard }} /></Card>
  </section>
}
