# Work Item: Diff View & Code Review

**Feature**: Pull Requests
**Phase**: 1
**Priority**: Critical

## Objective
Implement the core code review experience: viewing file changes, navigating the file tree, and commenting on lines.

## Requirements

### 1. Data Fetching
- **Diff Data**: `GET /_apis/git/repositories/{repo}/pullRequests/{id}/iterations/{last}/changes`.
- **File Content**: Need Original and Modified content for each file (Parallel fetch).

### 2. UI View (`/pr/:id/files` or inside Files tab)
- **Layout**:
  - **Left**: File Tree (Modified files only). Icons for Add/Edit/Delete.
  - **Main**: Diff Viewer.
- **Diff Viewer (CodeMirror 6)**:
  - **Split Mode**: Side-by-side original vs modified.
  - **Unified Mode**: Inline changes.
  - **Scrubbing**: Virtual scrolling.

### 3. Comments
- **Markers**: Retrieve threads and map them to line numbers (CodeMirror Gutters/Widgets).
- **Interaction**: Click line number -> Open comment box (Draft comment).

## Tasks
1. Implement `DiffService` (integrated into API/components). [x]
2. Configure CodeMirror `merge` view extension. [x]
3. Map Azure DevOps thread coordinates. [_] (General feed implemented, inline markers in progress)

## Completion Status
- **Branch**: `feat/pr-diff`
- **Status**: Completed (Core UI)
- **Changes**:
  - Updated `src/backend/services/azure.ts` with PR changes and versioned content.
  - Updated `src/backend/routes/prs.ts` and `repos.ts`.
  - Added `@codemirror/merge` dependency.
  - Created `src/frontend/components/pr/FileTree.tsx`.
  - Created `src/frontend/components/pr/DiffViewer.tsx`.
  - Updated `src/frontend/pages/PRDetail.tsx` to include the Files tab with diffing.

## Verification
- Open PR Files tab. [x]
- See list of changed files. [x]
- Click a TS file. [x]
- See side-by-side diff with syntax highlighting. [x]
- See existing comments inline. [_] (Visible in Overview activity feed)
