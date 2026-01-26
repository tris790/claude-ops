# Tasks: Improve Responsiveness & Search

## Problem
- **Lag**: The UI, especially the Repository List page, lags with thousands of projects/repos.
- **Findability**: Hard to find specific projects/repos; lack of "fuzzy search".
- **UX**: "Last Used" sorting and "Cloned First" sorting are missing.

## Solution Plan

### 1. Data Loading Strategy (Client-side)
- **Fetch All Metadata**: On app load (or first visit to Repos), fetch a lightweight JSON list of *all* accessible repositories (ID, Name, Project, CloneStatus).
- **Format**: `[{ id, name, project: { id, name }, isCloned }]`
- **Size Est**: 10k items * ~100 bytes = ~1MB. Acceptable for single fetch.
- **Performance**: Enable instant client-side filtering without backend roundtrips.

### 2. Implementation: "Last Used" History
- **Storage**: `localStorage` (Browser).
- **Structure**: simple list of `repoId`s with timestamps `[{ id: "...", lastAccessed: 123456789 }]`.
- **Policy**: LRU (Least Recently Used), keep top 20-50.

### 3. Implementation: Repository List UI
- **Filtering**: Implement client-side multi-select for "Projects" using the memory cache.
- **Sorting**:
  1.  **Cloned First**: Logic: `isCloned === true` -> top.
  2.  **Last Used**: Logic: `id` in `localStorage` -> sort by timestamp desc.
  3.  **Alphabetical**: Fallback.
- **Virtualization**: Ensure the list uses a virtual scraper (e.g. `react-window` or custom) to handle DOM performance for 1000s of items.
  - **Constraint**: Since virtualization breaks native browser `Ctrl+F`, the in-app search MUST be robust (fuzzy + exact match) to compensate.

### 4. Implementation: Command Palette
- Integrate the same memory cache into the Command Palette for instant "Go to Repo" fuzzy search.
- Use a fuzzy library (e.g. `fuse.js` or `cmdk` built-in scoring).

## Work Items
- [x] Create `useRepositoryCache` hook for fetching and caching repo metadata.
- [x] Implement `RecentRepositoriesService` (LocalStorage wrapper).
- [x] Update `RepositoryList` component:
    - [x] Add Client-side textual filter (Fuzzy).
    - [x] Add "Project" multi-select dropdown.
    - [x] Implement Sorting logic (Cloned > Recent > Alpha).
    - [x] Verify Virtualization.
- [x] Update Command Palette to use `useRepositoryCache`.

## Work Items: Pull Requests & Work Items
- [x] **Pull Requests**:
    - [x] Implement `usePullRequestCache` (simpler cache for Active/Recent).
    - [x] Add Search/Filter Input (Title, ID, Author).
    - [x] Virtualize List using `react-window`.
- [x] **Work Items**:
    - [x] Implement `useWorkItemCache` (focus on "Assigned to Me" and "Recent").
    - [x] Add Search/Filter Input (Title, ID, State).
    - [x] Refactor from `table` to `div`-based layout for easier virtualization.
    - [x] Virtualize List using `react-window`.