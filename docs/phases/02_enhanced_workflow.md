# Phase 2: Enhanced Workflow & Developer Experience

This phase unlocks the "Power User" features, specifically bridging the gap between a web interface and a local IDE. The focus is on deep integration and responsiveness.

## 1. Local Clone Management
- [x] **Backend Git Manager**:
  - [x] Logic to manage `~/.claude-ops/repos/`.
  - [x] Background `git fetch` operations.
- [x] **Clone UX**:
  - [x] UI indicators for cloned vs. remote repos.
  - [x] "Sync" buttons and status badges.
  - [x] One-click clone actions.

## 2. LSP Intelligence (The "Secret Sauce")
- [x] **Backend LSP Bridge**:
  - [x] Setup architecture to spawn/manage language servers (tsserver, gopls, etc.).
  - [x] WebSocket communication channel.
- [x] **Frontend Integration**:
  - [x] Connect CodeMirror to LSP events.
  - [x] **Rich Tooltips**:
    - [x] **Markdown Rendering**: Use `react-markdown` to render `Documentation` field from LSP. Ensure safe rendering and modern styling.
    - [x] **Syntax Highlighting**: Integrate `shiki` or `prismjs` for code blocks within the rendered markdown documentation.
    - [x] **Interactive Tooltips**: Tooltips must remain visible when the mouse moves into them to allow interaction with links.
    - [x] **Enriched Content**: Display full type signatures, JSDoc descriptions, and available parameter info.
  - [x] **LSP Navigation**:
    - [x] **Go to Definition**: Implement `F12` and `Cmd/Ctrl+Click` handlers mapping to `textDocument/definition`.
    - [x] **Location Mapping**: Transform LSP `Location` responses into internal app navigation paths (`/repos/:project/:repo/blob/:branch/*`).
    - [x] **Breadcrumbs**: Show clickable file/symbol paths in tooltips for easy navigation to referenced types.
  - [x] Implement Diagnostics (Squiggles/Errors).
  - [x] **LSP in Diff View**:
    - [x] **Position Mapping**: Translate diff-view coordinates (lines/cols) to actual document offsets for both `Original` and `Modified` buffers.
    - [x] **View Integration**: Ensure the `LSPProvider` attaches correctly to both panes in `Side-by-Side` mode and handles the `Unified` view context.

## 3. Interactive Code Review
- [ ] **Rich Commenting**:
  - [x] **Multi-line selection**: Implement range selection in CodeMirror using `EditorView.lineBlockAt`. Show a floating "Comment" button on selection end.
  - [x] **Azure DevOps Integration**: Map selection ranges to the `iterationContext` and `threadContext` in the PR Thread API.
  - [x] Markdown support in comments.
  - [x] Threaded replies.

- [x] **Review Submission**:
  - [x] **Local Drafts**: Store unsaved comment content in `localStorage` per PR/file to prevent data loss.
  - [x] **Status Control**: Add a "Review" menu in the PR header with one-click actions: `Approve`, `Approve with suggestions`, `Wait for author`, `Reject`.
  - [x] **Merge Integration**: Ensure "Complete PR" trigger is only enabled after successful review/policy checks.
- [ ] **Review Progress & Iterations**:
  - [ ] **Iteration Management**:
    - [ ] **Iteration Selector**: Component to switch between specific code pushes.
    - [ ] **Inter-iteration Diff**: Compare changes between arbitrary iterations (e.g., Iteration 2 vs Iteration 5).
  - [ ] **Review State**:
    - [ ] **File Completion**: Implement "Mark as reviewed" checkboxes in the file tree.
    - [ ] **Cumulative Diff**: Show only "Changes since my last review" based on tracked iteration history.

## 4. Real-Time Interactions
- [ ] **Live Updates**:
  - [ ] **Smart Polling**: Implement a `usePolling` hook via `Page Visibility API`. 
    - Active view: 5s interval.
    - Background/Hidden: Pause or 30s interval.
  - [ ] **Optimistic UI**: Implement React Query `onMutate` handlers for:
    - Adding/editing comments.
    - Changing PR status.
    - Marking files as reviewed.
- [ ] **Pipeline Streaming**:
  - [ ] **Log Fetcher**: Implement incremental log fetching using the `offset` parameter if available in Azure DevOps logs API.
  - [ ] **Virtual Log View**: Use `@tanstack/react-virtual` for the log console to handle tens of thousands of log lines without performance degradation.

## 5. Advanced Search & Command Palette
- [x] **Deep Search**:
  - [x] **Regex Engine**: Add a toggle in Command Palette. Backend uses `ripgrep` (`rg`) for cloned repos.
  - [x] **Contextual Results**: Show 2 lines of context around search matches in the results list.
- [x] **Advanced Filters**: 
  - [x] **Operator Support**: Parse `author:`, `state:`, `project:`, `repo:`, `ext:`, `file:` in the command palette search string.
  - [x] **Ranking Algorithm**: 
    - [x] Boost items in the current project.
    - [x] Boost recently/frequently accessed items.
    - [x] Fuzzy match baseline.
