# Work Item: Repository List

**Feature**: Remote Repository Browser
**Phase**: 1
**Priority**: High

## Objective
Create the "Landing Page" of the application: a grouped, searchable list of all repositories in the organization.

## Requirements

### 1. Data Fetching
- **Backend**: `GET /api/repos` -> Proxies to Azure DevOps `GET /_apis/git/repositories`.
- **Optimization**: Cache the list. It doesn't change often.

### 2. UI View (`/repos`)
- **Layout**: Group by Project.
- **Card**: Each repo is a card with:
  - Repo Name.
  - Description (if any).
  - Default Branch name.
  - "Clone Status" (Phase 2 placeholder, currently "Remote Only").
- **Filter**: Text input to filter list by name.

### 3. Navigation
- Clicking a repo card navigates to `/repos/:project/:repo`.

## Tasks
1. Create `RepoService` in frontend and backend route.
2. Build `RepoList` page component.
3. Implement grouping logic (Group by `project.name`).
4. Apply "Sapphire Blue" styling to project headers or active elements.

## Verification
- Load app.
- See list of all repos grouped by Project.
- Filter works.
- Click works.
