# Work Item: File Explorer (Remote)

**Feature**: Remote Repository Browser
**Phase**: 1
**Priority**: High

## Objective
Implement the file tree navigation for a specific repository, allowing users to browse folders and files without cloning.

## Requirements

### 1. Data Fetching
- **Azure API**: `GET /_apis/git/repositories/{repoId}/items?scopePath={path}&recursionLevel=OneLevel`.
- **Backend Service**: `RepoService.getTree(project, repo, path, version)`.

### 2. UI Component (`RepoBrowser`)
- **Route**: `/repos/:project/:repo`.
- **Split View**:
  - **Left**: File Tree (collapsible folders).
  - **Right**: File Content (see next work item) or README rendering.
- **Tree Interaction**:
  - Click Folder -> Expand/Fetch children.
  - Click File -> Navigate to `.../blob/:path` (or update Right pane).
- **Breadcrumbs**: Show path at top (e.g., `my-project / my-repo / src / index.ts`).

## Tasks
1. Create `Tree` component (or use a lightweight virtualization library if repos are huge, but start simple).
2. Implement recursive fetching (lazy load) on folder expand.
3. Handle "Breadcrumb" navigation.

## Verification
- Navigate to a repo.
- See root files/folders.
- Click `src` -> expands and shows children.
- Click a file -> URL updates.
