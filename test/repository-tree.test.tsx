import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildRepositoryTree, repositoryFolderIds, formatRepositorySize, formatRepositoryCommitDate, type RepositoryCommit } from '../lib/projects/repository-tree'
import { RepositoryTable } from '../components/computer/repository-table'

const files = [
  { path: 'src/components/Button.tsx', size: 2048 },
  { path: 'src/App.tsx', size: 1024 },
  { path: 'README.md', size: 500 },
]

test('repository folders derive sizes and file counts from saved files without mutating them', () => {
  const nodes = buildRepositoryTree(files)
  assert.equal(nodes[0].id, 'src')
  assert.equal(nodes[0].size, 3072)
  assert.equal(nodes[0].fileCount, 2)
  assert.equal(nodes[0].children?.[0].id, 'src/components')
  assert.equal(nodes[0].children?.[0].size, 2048)
  assert.deepEqual([...repositoryFolderIds(nodes)], ['src', 'src/components'])
  assert.equal(files.length, 3)
})

test('repository search retains ancestors and recalculates totals for matching paths', () => {
  const nodes = buildRepositoryTree(files, ' button.TSX ')
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].size, 2048)
  assert.equal(nodes[0].fileCount, 1)
  assert.equal(nodes[0].children?.[0].children?.[0].id, 'src/components/Button.tsx')
  assert.deepEqual(buildRepositoryTree(files, 'missing'), [])
  assert.equal(buildRepositoryTree(files, 'src/components')[0].fileCount, 1)
})

test('repository filenames that match object prototype properties are preserved safely', () => {
  const nodes = buildRepositoryTree([{ path: '__proto__/constructor/toString', size: 9 }])
  assert.equal(nodes[0].id, '__proto__')
  assert.equal(nodes[0].children?.[0].children?.[0].name, 'toString')
  assert.equal(nodes[0].size, 9)
  assert.equal(Object.prototype.hasOwnProperty('children'), false)
})

test('repository size formatting preserves zero-byte files and scales larger files', () => {
  assert.equal(formatRepositorySize(0), '0 B')
  assert.equal(formatRepositorySize(1024), '1 KB')
  assert.equal(formatRepositorySize(1024 ** 2), '1 MB')
})

test('the actual Astryx table renders saved rows, labeled search and expandable folder controls', () => {
  const html = renderToStaticMarkup(createElement(RepositoryTable, { files, selectedPath: 'README.md', onSelect: () => {} }))
  assert.match(html, /role="treegrid"/)
  assert.match(html, />Go to file<|aria-label="Go to file"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-selected="true"/)
  assert.match(html, /README\.md/)
  assert.match(html, /Last commit message/)
  assert.match(html, /Last commit date/)
  assert.match(html, /Commit details not connected/)
  assert.doesNotMatch(html, /Add file|Copy HTTPS clone URL|>Code</)
  assert.match(html, /aria-disabled="true"|disabled=""/)
  assert.doesNotMatch(html, /Button\.tsx/)
  assert.doesNotMatch(html, /Updated 2 hours|171 Branches|56 Tags/)
})

test('folder commit rollups keep message and date from the same newest surviving child', () => {
  const older: RepositoryCommit = { sha: 'a'.repeat(40), message: 'Add app', committedAt: '2026-11-10T08:00:00Z' }
  const newer: RepositoryCommit = { sha: 'b'.repeat(40), message: 'Update button', committedAt: '2026-11-11T08:00:00Z' }
  const commits = new Map([['src/App.tsx', older], ['src/components/Button.tsx', newer]])
  assert.deepEqual(buildRepositoryTree(files, '', commits)[0].lastCommit, newer)
  assert.deepEqual(buildRepositoryTree(files, 'App.tsx', commits)[0].lastCommit, older)
  assert.equal(buildRepositoryTree(files)[0].lastCommit, null)
  assert.equal(formatRepositoryCommitDate('2026-11-11T08:00:00Z', Date.parse('2026-11-11T11:00:00Z')), '3 hours ago')
})

test('available presentation metadata renders actual commits instead of unavailable placeholders', () => {
  const commits = new Map([['README.md', { sha: 'a'.repeat(40), message: 'Write project instructions', committedAt: '2026-11-11T08:00:00Z' }]])
  const html = renderToStaticMarkup(createElement(RepositoryTable, { files, selectedPath: null, onSelect: () => {}, commits }))
  assert.match(html, /Write project instructions/)
  assert.match(html, /datetime="2026-11-11T08:00:00Z"/i)
  assert.doesNotMatch(html, /Commit details not connected/)
})

test('an empty saved repository keeps the template toolbar, column headers and an honest empty state', () => {
  const html = renderToStaticMarkup(createElement(RepositoryTable, {
    files: [], selectedPath: null, onSelect: () => {}, branchCount: 0,
    branchControl: createElement('span', null, 'No saved branch'),
  }))
  assert.match(html, /No saved branch/)
  assert.match(html, /0 Branches/)
  assert.match(html, />Go to file<|aria-label="Go to file"/)
  assert.doesNotMatch(html, /Add file|Copy HTTPS clone URL|>Code</)
  assert.match(html, /Last commit message/)
  assert.match(html, /Last commit date/)
  assert.match(html, /No saved files yet/)
  assert.doesNotMatch(html, /No files match|171 Branches|56 Tags/)
})
