# Claude-Ops: Alternative Frontend for Azure DevOps

## Motivation

Azure DevOps is slow, clunky, lacks developer-oriented features, and is an overall subpar experience. This project aims to provide a fast, modern, and developer-friendly alternative.

---

## Target Audience

- **Enterprise organizations** with self-hosted Azure DevOps Server
- **Single-user local application** - each developer runs their own instance
- **Single organization**, multiple projects, multiple repositories per project
- Large teams of developers working across different repos

---

## Core Principles

- **Performance First**: Stay fast and responsive even with large datasets (repos, work items, files, pipeline runs)
- **Developer Experience**: Focus on workflows that developers actually use daily
- **Powerful Search**: Enable advanced search across all entities via command palette
- **Online-Only**: Local operations used only for performance/advanced features (LSP, faster code navigation)

---

## Authentication

- **Primary**: Personal Access Token (PAT)
- **Secondary**: Azure CLI integration (`az cli`) for token management/refresh
- **Single organization per instance** (no multi-org switching)

### PAT Storage
- **Mechanism**: `.env` file in application directory
- **Format**: Standard environment variable (`AZURE_DEVOPS_PAT`)
- **Rationale**: Simple, compatible with developer workflows, easy to gitignore

### First Run Experience
- **Quick Setup Wizard**: On first launch with no PAT configured, show a guided setup flow
  - Enter organization URL
  - Enter PAT
  - Test connection
  - Complete and redirect to repos list

### Invalid/Expired PAT Handling
- **Non-blocking error banner** displayed at top of page
- User can still browse cached data while unauthenticated
- Banner links to settings page to update credentials
- No full-screen auth walls or forced redirects

### API Rate Limiting
- **Automatic retry with exponential backoff** when rate limited
- Silent retry for transient errors
- Only surface errors to user after retries exhausted

---

## Features by Domain

### Command Palette & Global Search

The command palette is the central navigation hub, accessible everywhere (Ctrl+K or Ctrl+P style).

- **Code Search**: Fuzzy search with operator support
  - `file:pattern` - Filter by file path pattern
  - `ext:ts` - Filter by file extension
  - `repo:name` - Filter by repository
  - `project:name` - Filter by project
  - Regex toggle for pattern matching
- **Work Item Search**: Search by ID, title, filter by state/assignee/tags
- **PR Search**: Search by ID, title, author
- **Commit Search**: Search by hash, message
- **Pipeline Search**: Search by name
- **Actions**: Quick access to commands ("Create PR", "New Work Item", etc.)

### Recent Activity (Integrated)

Recent activity is **not a separate view** - it's integrated contextually throughout the app:
- **Command Palette**: Show recently accessed items when opened (before typing)
- **Work Items List**: Recent work items surfaced at top or as quick filter
- **PR List**: Recently viewed PRs highlighted or easily accessible
- **Repository Browser**: Recently opened files/repos for quick access
- Recency is tracked per entity type (work items, PRs, files, repos)

### Project Filtering

- **Default**: Show all accessible projects
- All lists (repos, PRs, work items, pipelines) can be filtered by project
- Easy project filter UI (dropdown/selector)
- Filter state persists within session
- Command palette project filter operator: `project:name`

### Work Items

**Process Template Support:**
- Standard templates (Scrum, Agile) + custom work item types
- Must dynamically load work item type definitions from the organization
- Support custom fields defined at organization/project level

**Phase 1 Editing Capabilities:**
- Change state (New, Active, Resolved, Closed, etc.)
- Assign to user
- Edit title and description
- Link to PRs and other work items
- Add and edit comments

**Core Features:**
- View work items with hierarchy (Epic > Feature > User Story > Task)
- Create and edit work items
- Link work items to pull requests
- View all PRs under a work item (tree view)
- List/table view with filters
- **Quick Filters**: Preset filter buttons (My Items, Assigned to Me, Recently Updated, etc.)

**Work Item Detail View:**
- **Description**: Rendered markdown content
- **Linked PRs & Commits**: Show all connected pull requests and commits
- **Hierarchy Navigation**: Parent/child work item tree (Epic > Feature > Story > Task)
- **Activity History**: Log of changes, comments, and state transitions
- **Inline Field Editing**: Edit state, assignee, iteration, and other fields directly from the detail view

**Later Phase:**
- Custom work item types and fields support
- Kanban board view (drag-and-drop columns)

**Not Planned:**
- Sprint/iteration views
- Azure DevOps saved queries (use preset filters instead)
- Bulk operations (state change, bulk assign)
- Time tracking fields (Original Estimate, Remaining Work, Completed Work)
- Attachment handling (low priority, may add later)

### Pull Requests

**PR Creation:**
- Create PRs for any repo (local clone not required)
- Select source/target branches from remote
- Set title, description, reviewers, work item links
- **Reviewers**: Support both individual users and team/group reviewers
- **Draft PRs**: Full workflow support
  - Create new PR as draft
  - Visual draft badge/indicator
  - One-click "Publish" to make ready for review

**Diff View Experience:**
- **View Modes**: User-toggable between:
  - **Side-by-Side** (resizable panes)
  - **Inline** (unified)
  - **New Code Only**
- **IntelliSense**: All view modes support full LSP features (navigation, hover, etc.)
- **Large Diffs**:
  - File-by-file view support
  - Continuous scroll with search capabilities (searching beyond viewport)
- **Inline Suggestions**: Support for change suggestions (like GitHub)

**PR Iterations:**
- Support for viewing specific iterations (code pushes) of a PR
- Compare between iterations to see incremental changes
- View what changed since last review

**Code Review Workflow:**
- **Immediate Feedback**: Comments posted immediately (no "Review Session" or batching)
- **Status Updates**: Manual status change (Approve, Reject, Wait) when ready
- **No Formal Start/Finish**: Fluid process without strict state transitions

**Comments:**
- **Placement**: Multi-line range selection support
- **Display**: Inline in code + Summary list under PR description
- **Interaction**: Reply from both locations (inline diff view AND summary list)
- **Threaded**: Full support for threaded discussions
- **Markdown**: Full GitHub-style markdown support
  - Code blocks with syntax highlighting
  - Tables, lists, blockquotes
  - Inline images
  - Live preview while editing
- **Code Suggestions**: GitHub-style suggestion blocks
  - Suggest specific code changes in comments
  - Reviewee can apply suggestions with one click
  - Suggestions shown as diff preview in comment

**File Navigation:**
- **Tree View**: Hierarchical view of changed files with collapsible folders
- **Stats**: Added/removed line counts per file
- **Change Type Icons**: Visual indicators for added, modified, and deleted files
- **File Filtering**: Filter files by extension or path pattern
- **Review Checkbox**: Manual per-file checkbox to mark files as reviewed (user-controlled, not automatic)
- **Keyboard**: Standard navigation (no specific jump shortcuts required)

**Policies & Status:**
- **Compact by Default**: Show summary status (pending/success/failure icons)
- **Expand on Interaction**: Full details with re-run capability on click
- **Real-Time Integration**: Display live status of policies (builds, reviewers)
- **Blocking vs Optional**: Clearly distinguish required policies from advisory ones
- **Visuals**: Clear pass/fail/pending indicators per policy
- **Constraints**: No admin override capabilities provided (must fix policies to merge)

**Merge Conflicts:**
- Show conflict indicator when PR has conflicts
- Display list of conflicting files
- Resolution must be done via command line (no in-app resolution)

**PR Lifecycle:**
- **Abandon**: Ability to abandon active PRs
- **Reactivate**: Ability to reactivate abandoned PRs
- Standard complete/merge flow

**Auto-Complete:**
- View current auto-complete status
- Toggle auto-complete on/off
- Configure auto-complete options:
  - Delete source branch after merge
  - Complete associated work items
  - Merge strategy selection

**Merge Options:**
- **Default**: Squash merge
- **Later Phase**: Add support for other strategies (rebase, merge commit)
- Delete source branch option
- Transition linked work items option

**Not Planned:**
- PR labels/tags

### Pipelines

**Pipeline Type Support:**
- **YAML Pipelines Only**: Classic (UI-defined) pipelines not supported
- No Classic Release Pipelines support

**Core Features:**
- List all pipelines
- Start pipelines (for any branch)
- Cancel running pipelines
- View pipeline progress with real-time streaming logs
- Log search/filtering within a pipeline run
- Download logs
- Download pipeline artifacts
- View pipeline history
- Real-time status updates (in-view)

**Manual Approvals:**
- View pending approval gates
- Approve or reject approval gates directly from the app
- See who approved/rejected and when

**Template Visibility:**
- Show which templates a YAML pipeline extends/uses
- Navigate to template source files

**Pipeline Display Modes (User Toggleable):**
- **Visual Stage Graph**: Graphical representation of stages/jobs with dependencies
- **Stage List + Expandable Jobs**: List of stages, each expandable to show jobs and logs
- **Flat Log View**: All logs in one scrollable view with stage headers

**Pipeline Triggering:**
- Select branch, then run with default parameters
- No runtime parameter/variable input or override (pipelines should define sensible defaults)

**Not Planned:**
- Classic pipelines
- Classic Release Pipelines
- Environment management
- Variable/parameter override on trigger

**Optional:**
- Edit pipeline YAML from the app

### Repository Browser

**Core Features:**
- Navigate and browse code from repos
- Full-text code search with fuzzy/regex support
- Shareable links to specific lines
- Commit history per file/branch
- Commit diff (view changes between commits)
- Git tags: View and search tags

**File Preview Support:**
- Syntax-highlighted code files
- Markdown preview (rendered)
- Image preview (common formats: PNG, JPG, GIF, SVG)
- JSON/YAML with pretty formatting
- Other binary files: show file info, offer download

**Git Blame View:**
- **Inline Gutter Annotations**: Commit info displayed in line gutter
- **Hover Tooltip**: Hover on annotation shows full commit message, author, date
- **Click to View**: Click annotation to navigate to full commit detail

**Commit View:**
- **Summary**: Commit message and metadata (author, date, hash)
- **Diff View**: Full file diff like PR diffs

**Code Search Strategy:**
- **Primary**: Azure DevOps Code Search API (organization has extension enabled)
- **Cloned repos**: Use local search (ripgrep-based) for faster, more advanced search
- Search automatically uses best available method per repo

**Local Clone Integration:**
- Clone is optional, but unlocks LSP features and faster search
- **Sync All**: Button in repos list to sync all cloned repos
- **Repo-specific Sync**: Button within repo view and PR view to sync that specific repo
- Dedicated managed clone directory (`~/.claude-ops/repos/`)

**LSP Language Priorities:**
Languages in order of priority for LSP integration:
1. C# (.NET) - OmniSharp or Roslyn-based
2. TypeScript/JavaScript - tsserver
3. Go - gopls
4. C/C++ - clangd

**Repository List (Landing Page):**
- All repos in organization displayed
- **Clone Status Indicators**: Visual markers showing which repos are cloned locally
- Grouped by project
- Quick filter buttons (Cloned, All)

**Branch Operations:**
- View all branches
- Create branches
- Delete branches (from branch list or after merging PR)

**Not Planned:**
- Direct file editing/commits from browser
- Branch protection policy management (managed in Azure DevOps)
- Visual git graph (branch/merge visualization)

---

## Architecture & Constraints

### Installation & Distribution
- **Package Manager**: Distributed via Bun
- **Run Command**: Users run with `bun` (e.g., `bunx claude-ops` or similar)
- No standalone binaries in initial release
- No Docker container in initial release

### Environment
- **Deployment**: Locally hosted application (runs on developer's machine)
- **Single-tenant**: One organization, user's own Azure DevOps account
- **Configurable**: Organization URL, authentication tokens, and settings are user-provided
- **Multi-window Support**: Multiple browser tabs/windows can connect to the same backend instance

### API Compatibility
- **Target API Version**: Azure DevOps REST API 7.0 (supports Azure DevOps Services and Server 2022+)
- Compatible with self-hosted Azure DevOps Server instances
- Works with private organizations

### Expected Scale
- **Target**: Large enterprise (1000+ repos, 100K+ work items)
- All lists must use pagination and virtual scrolling
- Caching strategies must be optimized for high volume
- Repositories up to 1GB in size (small monorepos supported)

---

## Technical Architecture

### Backend (Bun)

The backend is **not a simple proxy** - it has significant responsibilities:

- **Azure DevOps API Integration**: Calls and aggregates data from Azure DevOps REST API
- **Git Clone Management**: Clones, syncs, and manages local repository copies
- **LSP Server Management**: Spawns and manages LSP servers per-project (abstracted from user)
- **Local Database**: Uses Bun's built-in SQLite for local indexing and caching
  - Bun provides high-performance native SQLite3 with WAL mode support
  - Features: prepared statements, transactions, bigint support, class mapping
- **Search Indexing**: Potentially maintains search indices for fast code/entity lookups

### Frontend-Backend Communication

- **REST API**: Primary communication protocol for data fetching
- **Real-Time Updates**: 
  - Azure DevOps uses SignalR (WebSocket-based) for instant updates
- **Our approach**: Hybrid (Polling + Streaming + WebSocket for LSP)
    - **Rationale**: See "Real-time Updates Strategy" section below for full details.
  - Requirements regardless of approach:
    - Very large update streams (e.g., pipeline logs)
    - Automatic reconnection after disconnection
    - Non-intrusive disconnect handling (small icon at most, no annoying popups)
    - Low latency for LSP features

### State Management Philosophy

- **Avoid bloated libraries**: Bundle size is critical - every library is a performance tax
- **Prefer lightweight solutions**: Lean toward React Context, native hooks, or minimal libraries
- **Don't fear custom solutions**: Building our own state management is acceptable if it stays lean
- **Evaluate carefully**: Weigh benefits vs. bundle size before adding any dependency

### Performance Strategy

**Bundle Size:**
- **Target**: Small bundle (<1MB gzipped) - speed is a core motivation for this app
- Every dependency must justify its weight
- Tree-shaking must be verified for all imports
- Consider alternatives: native APIs over polyfills, smaller libraries over feature-rich ones

**Prefetching (Google-inspired approach):**
- **Hover-based prefetching**: On desktop, hovering over list items (PRs, work items, files) can trigger prefetch
- Prefetch likely-needed data when user hovers for short duration (~200ms)
- Cancel prefetch if user moves away before it completes
- No aggressive background prefetching - only on explicit intent signals

**Async Loading Guidelines:**
- **Minimize async splitting**: Unless a component is extremely heavy, the deferral cost often outweighs benefits
- **When async is used**: Always use skeleton placeholders to prevent layout shift
- **Never defer**: Any component the user will immediately interact with
- **Acceptable async**: Heavy editors, rarely-used settings panels, visualization libraries
- **Goal**: UI feels ready instantly - perceived performance over actual load metrics

### LSP Architecture

- **Per-Project LSP Servers**: Backend spawns LSP servers for each active project
- **User-Transparent**: LSP management is completely abstracted - "it just works"
- **No Bundled LSP Servers**: We don't bundle LSP servers
- **Auto-Detection**: Detect LSP servers from user's VS Code installation when possible
- **Auto-Install Option**: Offer to install missing LSP servers for the user's project languages
- **Communication**: Must be low-latency and resilient (WebSocket bridge via backend likely)

**Priority Languages (Phase 2):**
1. TypeScript/JavaScript (tsserver)
2. C# (OmniSharp or Roslyn-based)
3. Go (gopls)

### Clone Management

- **Default Directory**: `.repos/` relative to app, or `~/.claude-ops/repos/`
- **User-Configurable**: Changeable via web app settings (persisted to disk)
- **Clone Tracking**: App tracks which repos are cloned vs. remote-only
- **Repository List UX**:
  - Cloned repos shown first, marked with visual indicator
  - Display sync status (up-to-date with remote, behind, etc.)
- **Sync Strategy**: 
  - User can opt-out of cloning entirely
  - "Sync All" button for bulk operations
  - Per-repo sync available when browsing (visible and accessible)
  - Easy one-click clone when browsing non-cloned repo
- **Large Monorepos**: Handled like any repo - app must be fast regardless of size

---

## User Experience

### Keyboard Navigation
- Standard shortcuts (arrows, tab, enter) - start minimal, expand as needed
- Command palette is the primary navigation method (Ctrl+K / Ctrl+P)
- No vim-style navigation in initial version

### Theming
- **Default**: Dark mode
- **Available**: Light mode toggle
- **Design Identity**: Unique, modern aesthetic
  - Avoid purple
  - Avoid generic AI/LLM color palettes (Claude orange/beige, Gemini blue)

### Real-Time Updates
- In-view updates only (no page refresh required):
  - PR view: Comments, approvals, code changes
  - Pipeline view: Status, logs
  - Work item view: State changes, assignments
- No system/desktop notifications

---

## Resolved Decisions

### Command Palette Ranking Strategy
Search results are ranked using a **multi-factor score**:
1. **Project Scope**: Items from current project context ranked higher
2. **Recency**: Recently accessed items get a boost
3. **Frequency**: Items accessed more often get a boost  
4. **Match Quality**: Fuzzy match score (required baseline)

The final rank = weighted combination of all factors. Items must pass a match quality threshold before other factors apply.

### Cache Invalidation Strategy
**Optimistic caching with event-driven invalidation** (no TTL):

1. **Initial Load**: Always serve from cache immediately if available (optimistic)
2. **Event Invalidation**: User actions (approve PR, update work item) immediately invalidate related cache entries
3. **Background Status Check**: Periodically check if cached data has changed, invalidate and update UI if stale
4. **No TTL**: Data does not expire based on time - only invalidated by events or background checks
5. **UI Updates**: When cache is invalidated, UI updates seamlessly (no full refresh)

### User Preference Persistence
The app remembers the following user preferences (stored in `config.json`):
- **Diff View Mode**: Last used mode (side-by-side, inline, new-code-only)
- **Pane Sizes**: User-resized pane widths persist across sessions

### LSP Language Detection
- **File Extension Based**: Detect language from file extension, map to appropriate LSP server
- Follows VS Code's model of extension-based language detection
- Standard mapping (e.g., `.ts` -> TypeScript LSP, `.py` -> Python LSP)

### Syntax Highlighting Strategy
**CodeMirror 6** for all code display with LSP semantic token enhancement:

1. **Core Highlighter**: CodeMirror 6 (Lezer parser)
   - High-quality incremental parsing (similar to Tree-sitter)
   - Built-in diff/merge view support
   - Virtual scrolling for large files
   - Line number linking
   - Estimated bundle: ~80KB gzipped

2. **Hybrid Architecture**:
   | Scenario | Behavior |
   |----------|----------|
   | Remote (non-cloned) repo | CodeMirror 6 lexical highlighting only |
   | Cloned repo (LSP available) | CodeMirror 6 + LSP semantic tokens overlay |
   | Large files | Virtual scrolling, no performance degradation |

3. **Why CodeMirror 6**:
   - Used by Google Code Search (cs.opensource.google) for similar use case
   - Provides diff rendering, virtual scrolling, and line linking out of the box
   - Well under the 1MB budget (~80KB) while providing editor-grade features
   - LSP `textDocument/semanticTokens` can overlay for enhanced highlighting when available
- User can override mappings in settings if needed

### Real-time Updates Strategy
**Hybrid approach** with protocol selection based on use case:

| Communication Type | Protocol | Rationale |
|--------------------|----------|----------|
| LSP Bridge | WebSocket | LSP requires sub-100ms latency for hover/autocomplete |
| Pipeline Logs | Streaming Fetch | Large update streams via chunked transfer encoding |
| PR/Work Item/List Views | HTTP Polling (5-10s) | Infrequent updates, simple, cache-friendly |
| User Actions | Optimistic Updates | Immediate UI feedback with cache invalidation |

**Key decisions:**
1. **LSP requires WebSocket** - Non-negotiable for responsive code intelligence
2. **HTTP polling for entity updates** - Azure DevOps has no push API; we poll their REST API regardless
3. **Streaming fetch for logs** - Simpler than WebSocket for large sequential data
4. **Pause polling when tab hidden** - Use Page Visibility API to reduce unnecessary requests
5. **Configurable intervals** - Active views poll faster (5s), background views slower (30s)

**Why not pure WebSocket:**
- Adds complexity without benefit when data source (Azure DevOps API) is polled anyway
- HTTP responses integrate with browser caching and React Query patterns
- Easier debugging in DevTools
- Graceful handling of backend restarts without reconnection logic

### Clone Sync Strategy
**Hybrid approach** with background fetch + contextual refresh + manual controls:

| Trigger | Behavior | Operation |
|---------|----------|----------|
| Background interval | Every 5 minutes for all cloned repos | `git fetch` only |
| Navigation to repo view | When entering PR diff or file browser | `git fetch` (non-blocking) |
| Manual "Sync" button | User-initiated, always available | `git pull` (fetch + merge) |

**Detailed behavior:**

1. **Background Fetch** (passive)
   - Interval: 5 minutes (matches GitHub Desktop)
   - Scope: All cloned repositories
   - Operation: `git fetch` only (no merge/pull to avoid conflicts)
   - Pauses when tab is hidden (Page Visibility API)
   - User can disable in settings

2. **Contextual Refresh** (navigation-triggered)
   - PR diff view: Fetch repo to ensure accurate diff
   - File browser: Check if behind remote, show indicator
   - Non-blocking: Shows "X commits behind" badge, doesn't auto-pull

3. **Manual Sync** (user control)
   - Repo list: "Sync All" button for bulk operation
   - Per-repo view: "Sync" button in header/toolbar
   - PR view: "Sync" button when viewing cloned repo
   - Operation: Full `git pull` (fetch + fast-forward/merge)

4. **Status Indicators**
   - Display: "Up to date", "3 commits behind", "Syncing..."
   - Small icon/badge, not prominent
   - No toast notifications (per UX guidelines)

**Configuration options:**
```json
{
  "sync": {
    "autoFetchEnabled": true,
    "autoFetchIntervalMinutes": 5,
    "fetchOnNavigation": true,
    "pauseWhenHidden": true
  }
}
```

**Rationale:**
- Matches industry patterns (GitHub Desktop, VS Code, SourceTree)
- Background fetch keeps repos ready; navigation never blocked
- Fetch-only prevents unexpected merge conflicts
- Manual sync gives users full control when needed


### LSP Server Resolution Strategy
**Tiered discovery approach** to prioritize using existing tools:

1.  **Tier 1: System Path (Native Toolchains)**
    *   Check for standard binaries in `$PATH` (e.g., `gopls` for Go, `clangd` for C++, `rust-analyzer` for Rust).
    *   Best for languages where the LSP is part of the standard toolchain.

2.  **Tier 2: VS Code Extensions (Reuse)**
    *   Detect installed VS Code extensions in default locations (e.g., `~/.vscode/extensions/`).
    *   Launch specific LSP binaries found within known extensions (e.g., `ms-python.python`, `ms-dotnettools.csharp`).
    *   Ensures consistency with the user's primary editor environment.

3.  **Tier 3: Managed Download (Fallback)**
    *   If no server is found, offer to auto-download a compatible server logic to `~/.claude-ops/lsp/`.
    *   Completely isolated from system; managed by the app.
    *   **NO Bundled Servers**: We do not bundle servers in the installer to keep the distribution size small.

---

## Open Questions

> Remaining items to finalize
none

---

## Phasing

### Phase 1: Core MVP
- Authentication (PAT)
- Command palette with basic search
- PR list, view, and basic code review
- Pipeline list, trigger, view logs
- Work item list and view
- Repository browser (remote-only)

### Phase 2: Enhanced Code Review
- Local clone management
- Full LSP integration
- Real-time updates

### Phase 3: Extended Features
- Custom work item types/fields
- Kanban board
- Pipeline YAML editing
- Advanced search features

---

## Non-Goals

- Offline support
- Multi-organization switching
- Sprint/iteration management
- Pipeline parameter input
- Branch protection policy management
- Desktop notifications
- Direct file editing/commits