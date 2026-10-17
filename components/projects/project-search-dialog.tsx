"use client"

import { useState } from 'react'
import { Command } from 'cmdk'
import { Search, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import styles from './project-search-dialog.module.css'

type SearchProject = { id: string; prompt: string; kind?: string }

export function ProjectSearchDialog({ projects, loading, error, onOpenProject }: {
  projects: SearchProject[]
  loading: boolean
  error?: string | null
  onOpenProject: (project: SearchProject) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setQuery('') }}>
    <DialogTrigger asChild><button type="button" aria-label="Search projects" title="Search projects" className={styles.trigger}><Search size={19} strokeWidth={1.7} aria-hidden /></button></DialogTrigger>
    <DialogContent showCloseButton={false} className="relative flex max-h-[calc(100dvh-2rem)] max-w-full flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl sm:max-w-[640px]">
      <div className={styles.heading}>
        <DialogTitle className="font-sans text-xs font-medium text-muted-foreground">Search projects</DialogTitle>
        <DialogDescription className="sr-only">Find a saved project by name. Use the arrow keys to choose a result and Enter to open it. Escape closes search.</DialogDescription>
        <DialogClose asChild><button type="button" aria-label="Close project search" className={styles.close}><X size={17} aria-hidden /></button></DialogClose>
      </div>
      <Command label="Saved projects" className={styles.command} loop>
        <div className={styles.inputRow}><Search size={21} strokeWidth={1.6} aria-hidden /><Command.Input autoFocus value={query} onValueChange={setQuery} aria-label="Search saved projects" placeholder="Find a project…" className={styles.input} /></div>
        <Command.List className={styles.list} aria-label="Project results" aria-busy={loading}>
          {error ? <p role="alert" className={styles.message}>{error}</p> : loading ? <p role="status" className={styles.message}>Loading projects…</p> : <>
            <Command.Empty className={styles.message}>{projects.length ? 'No projects match your search.' : 'No saved projects yet.'}</Command.Empty>
            <Command.Group heading={query ? 'Search results' : 'Recent projects'}>
              {projects.map(project => <Command.Item key={project.id} value={project.id} keywords={[project.prompt]} className={styles.result} onSelect={() => { setOpen(false); setQuery(''); onOpenProject(project) }}>
                <span className={styles.projectName}>{project.prompt.trim() || 'Untitled project'}</span><span className={styles.openHint} aria-hidden>↵</span>
              </Command.Item>)}
            </Command.Group>
          </>}
        </Command.List>
      </Command>
      <div className={styles.footer} aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>esc</kbd> Close</span></div>
    </DialogContent>
  </Dialog>
}
