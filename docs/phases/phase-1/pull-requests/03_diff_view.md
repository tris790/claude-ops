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
1. Implement `DiffService` to orchestrate fetching content for both sides of the diff.
2. Configure CodeMirror `merge` view extension.
3. Map Azure DevOps thread coordinates (Left/Right buffer, Line X) to CodeMirror positions.

## Verification
- Open PR Files tab.
- See list of changed files.
- Click a TS file.
- See side-by-side diff with syntax highlighting.
- See existing comments inline.
