# Tasks: LSP Architecture V2 (Context-Aware & Persistent)

Based on `docs/proposals/lsp_architecture_v2.md`.

## Backend Implementation

### 1. Git Context Manager (Checkout Strategy)
Manage the local repository state to match the PR's context using direct checkouts.

- [x] **Implement `GitContextManager` Service**
    - **Goal**: Switch local repo definition to the specific PR commit.
    - **Path**: `src/backend/services/git/GitContextManager.ts`
    - **Methods**:
            - Checks if `HEAD` is already at `commitHash`.
            - **Dirty State Handling**:
                - lsp might not work if the repo is dirty if we can notify the user even better
    - **Validation**: Ensure `HEAD` matches `commitHash`. 

### 2. LSP Process Lifecycle (Persistence)
Solve the startup latency problem by keeping processes alive.

- [x] **Update `LSPManager` for Persistence**
    - **Goal**: Reuse LSP instances across navigation events.
    - **Path**: `src/backend/services/lsp/LSPManager.ts`
    - **Changes**:
        - Change storage from `Map<Repo, Process>` to `Map<RepoPath, LSPProcessEntry>`.
        - `LSPProcessEntry` checks: `process`, `lastUsed`, `refCount`.
        - **Keep-Alive**: When a client disconnects (navigates away), do **not** kill the process immediately. Set `lastUsed = now()`.
        - **Documentation**: Add inline comments explaining the state machine (Active -> Idle -> Killed).

- [x] **Implement TTL and LRU Eviction**
    - **Goal**: Prevent resource exhaustion.
    - **Path**: `src/backend/services/lsp/LSPManager.ts`
    - **Task**:
        - Implement a mechanism (interval or event-based) to check for idle processes.
        - **TTL**: If `lastUsed > 5 minutes` and `refCount === 0`, kill the process.
        - **LRU Cap**: Max 3 concurrent LSP processes. If spawning a 4th, kill the one with the oldest `lastUsed`.

### 3. PR View Integration
Connect the PR opening flow to the new backend capabilities.

- [x] **Hook into PR Open Event**
    - **Goal**: Prepare the LSP environment when a user opens a PR.
    - **Path**: `src/backend/routes/pr.ts` (or equivalent controller)
    - **Task**:
        - When fetching PR details, trigger `GitContextManager.ensureCommit(...)` asynchronously for the PR's source commit.
        - Initialize (or warm up) the LSP server for the repo path.
    
## Frontend Implementation

### 4. Smart Navigation (Definition)
"Chromium-style" jumping between diffs and files.

- [x] **Implement `LSPDefinitionHandler`**
    - **Goal**: Intercept `textDocument/definition` results and route correctly.
    - **Path**: `src/frontend/features/lsp/navigation.ts`
    - **Logic**:
        - Receive `Location` (URI + Range) from LSP.
        - **Scenario A (File in PR)**: If the file path corresponds to a file modified in the PR:
            - Navigate to the **Diff View** page (`/pr/:id/files?file=...`).
            - Scroll to the specific line in the *After* (Modified) pane.
        - **Scenario B (File Unchanged)**: If the file is not in the PR:
            - Navigate to the **File Browser** page (`/repos/:repo/blob/:commit/...`).
            - Open the file in read-only mode at the specific line.
    - **Dependencies**: Need access to the list of modified files in the current PR context.

### 5. Smart Navigation (References)
View usage across the codebase.

- [x] **Create `ReferencesPanel` Component**
    - **Goal**: Display `textDocument/references` results.
    - **Path**: `src/frontend/components/lsp/ReferencesPanel.tsx`
    - **UI**:
        - Resizable panel (bottom or side).
        - List references grouped by file.
        - Show code snippet (2-3 lines) context for each match.
        - **Virtualization**: Use virtual scrolling to handle large numbers of references (50+).
        - Click action: Uses the same logic as `LSPDefinitionHandler` (jump to Diff or File).
    - **UX**: Show a loading skeleton while fetching references.

### 6. Bug fixes
### 6.1 Diff View
- [ ] **Vertical scrolling broken in Diff View**
    - **Fix**: Inspect CSS in `DiffViewer.tsx`. Ensure the flex container allows the `MergeView` to calculate its height correctly. Remove `overflow-hidden` where it might be clipping the inner scrollable content. Ensure `.cm-mergeView` is set to `height: 100%`.

### 6.2 UI & Navigation
- [ ] **F12 opens DevTools instead of "Go to Definition"**
    - **Fix**: Add a global `window` keydown listener to intercept `F12` and call `e.preventDefault()`. Alternatively, ensure CodeMirror's `keymap` returns `true` and the event doesn't bubble. Should only be applied when user is viewing a pr diff or browsing code etc.
- [ ] **Ctrl + Click opens a blank new page**
    - **Fix**: In `FileViewer.tsx` and `DiffViewer.tsx`, the `mousedown` handler must call `event.preventDefault()` to suppress the browser's default behavior for modified clicks.
    - **Fix**: Update the `a` tag renderer in the hover tooltip to intercept `file:///` URIs and use internal navigation instead of `window.open`.
- [ ] **References Panel cannot be resized**
    - **Fix**: Implement a resize handle at the top of `ReferencesPanel.tsx`. Use `mousedown`/`mousemove` listeners to update a `height` state.

