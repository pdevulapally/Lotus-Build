# Repository browser backend handoff

## User-approved scope

The frontend is `C:\Users\Preet\Desktop\Lotus-Build`. The separate backend is `C:\Users\Preet\Desktop\lotusbuildbackendserver`. This task changed the frontend only. Do not treat this document as evidence that any new backend contract exists or has been deployed.

The user wants the toolbar and tree table from https://astryx.atmeta.com/templates?preview=table-tree inside the existing smaller workspace panel. Stop at the table: no About sidebar or README section. The user has subsequently removed the Add file and Code toolbar buttons and the Code / Branches / Pull requests tab row. Do not reintroduce them. Preserve the sidebar Repository entry, branch browsing, file preview, keyboard navigation and internal Back behavior. Back must not close the workspace panel. ZIP download stays removed.

## Existing verified contracts

- `GET /projects/:projectId/files?ref=branch`: saved snapshot branch listing and files (`path`, `size`), plus `head`, `ref`, `branches`, `truncated`. `head` is a branch name, not a commit SHA. The current implementation caps the branch listing at 200.
- `GET /projects/:projectId/files/content?path=...&ref=branch`: read-only file content with binary/truncation flags.
- `GET /projects/:projectId/changes` and `/changes/:sha`: saved history and commit diffs; these do not currently provide an efficient per-file latest-commit listing for arbitrary selected refs.
- `GET /projects/:projectId/sessions?limit=100`: the frontend displays PR deliveries reported by these tasks, deduplicated by repository and PR number. This is not a complete GitHub PR listing.
- Existing project source binding supplies `fullName` and `defaultBranch`; the header can open the bound repository on GitHub. The Code/clone toolbar menu has been removed.

Backend read-only evidence: `src/projects/files.ts`, `src/projects/content-routes.ts`, `src/projects/repository.ts`, `src/connections/routes.ts`, `src/sessions/routes.ts`. Reinspect the current checkout; both repositories contain unrelated work.

## Current frontend state

`components/computer/repository-table.tsx` uses Astryx Table, Card, TextInput, Button and DropdownMenu. Its columns match the reference: Name, Last commit message, Last commit date. Tags are explicitly unavailable. Missing commit values render an em dash with an accessible unavailable label, with one explanatory notice. No mock counts or commits are used, and no speculative endpoint is called. The toolbar and table remain visible for empty repositories. Add file and Code buttons are absent by user request.

The component accepts presentation props for later integration:

```ts
interface RepositoryCommit {
  sha: string;
  message: string;
  committedAt: string; // validated ISO timestamp
}
commits?: ReadonlyMap<string, RepositoryCommit | null>; // file path -> commit
tags?: readonly string[];
onSelectTag?: (tag: string) => void;
```

These are UI models, NOT existing server response fields. The live frontend deliberately does not pass commit/tag props yet. Folder rollups are derived from the newest surviving child after filtering; message, SHA and date stay together. A frontend follow-up must validate/map the actual agreed backend response before passing these props or enabling mutations.

## Backend work requested

1. Provide real saved tags, completeness/pagination information, and branch/tag selection that disambiguates colliding names. Keep file listing and file content pinned to the same resolved commit. Never silently fall back to the default branch after an invalid ref.
2. Provide latest relevant commit metadata for listed file paths, with explicit null/unavailable/truncated states. Preserve whole commit snapshots, handle empty repositories and merges, and avoid one provider request or subprocess per file. Do not fabricate timestamps or assign the repository's latest commit to every file.
3. File creation/upload and clone controls have been removed from the current UI. Do not implement mutations solely on the basis of the original template screenshot. Obtain a new product instruction before adding these flows; their write destination, overwrite behavior and active-sandbox synchronization were never settled.
4. Keep ownership, permission checks, ref validation, snapshot isolation and limits server-owned. Never expose installation tokens, signed storage URLs or Git credentials. Do not implement a second persistence system.
5. Do not infer permission to implement branch/tag deletion, merge, publishing, deployment or production writes. If extending PR coverage later, distinguish task deliveries from provider PR state and document the actual contract.

## Contract delivery and verification

Prefer additive changes to existing read contracts when appropriate; inspect ownership, caching, snapshot isolation and server limits first. New mutation routes must be explicitly documented rather than guessed by the frontend. Keep errors structured and required state explicit.

Return exact method/path, request/query/body schema, auth and permission rules, response JSON examples, pagination/completeness semantics, conflict/idempotency behavior and error codes. State whether each contract is local-only or deployed. Include the precise frontend mapping/enablement steps; the current response parsers do not yet consume the proposed metadata.

Test unauthorized and cross-owner access, malformed/nonexistent/colliding refs, empty/large repositories, missing commits, folder/search rollups, branch-consistent reads, traversal and symlink attempts, oversized uploads, stale heads, duplicate mutations and concurrent saves. Run the backend's existing checks without altering unrelated work. Do not commit, push, deploy or restart production without explicit authorization.
