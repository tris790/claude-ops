# Work Item: Navigation Commands & Fuzzy Search

**Feature**: Command Palette
**Phase**: 1
**Priority**: High

## Objective
Implement the logic to populate the command palette with navigational items (Repos, Projects) and enable fuzzy search.

## Requirements

### 1. Data Sources
- **Repos**: Fetch list of repositories from caching layer or API.
- **Projects**: Fetch list of projects.
- **Recent**: Track formatted history of visited items.

### 2. Search Logic
- **Fuzzy Matching**: Match user input against item titles/paths.
- **Ranking**:
  1. Exact match.
  2. Starts with.
  3. Contains.
  4. Acronyms (optional).
- **Recency**: Boost recently visited items.

### 3. Actions
- **Format**: Each item needs a `label`, `icon`, `type`, and `action` (callback or URL).
- **Execution**: On select, perform navigation (`navigate('/repos/foo/bar')`).

## Tasks
1. Implement a `SearchService` (frontend) or `useCommandSearch` hook.
2. Integrate with `RepoService` (to be built) to get the list of repos.
3. Add logic to filter/sort results based on query.
4. Persist "Recent Items" in generic local storage.

## Verification
- Open Palette.
- Type partial repo name (e.g., "claude").
- See "claude-ops" repo in results.
- Select it -> Navigate to Repo Browser.
