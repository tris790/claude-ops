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

### Invalid/Expired PAT Handling
- **Non-blocking error banner** displayed at top of page
- User can still browse cached data while unauthenticated
- Banner links to settings page to update credentials
- No full-screen auth walls or forced redirects

---

## Features by Domain

### Command Palette & Global Search

The command palette is the central navigation hub, accessible everywhere (Ctrl+K or Ctrl+P style).

- **Code Search**: Fuzzy search, regex, filtering by project/repo/path
- **Work Item Search**: Search by ID, title, filter by state/assignee/tags
- **PR Search**: Search by ID, title, author
- **Commit Search**: Search by hash, message
- **Pipeline Search**: Search by name
- **Actions**: Quick access to commands ("Create PR", "New Work Item", etc.)

### Work Items

**Core Features:**
- View work items with hierarchy (Epic > Feature > User Story > Task)
- Create and edit work items
- Link work items to pull requests
- View all PRs under a work item (tree view)
- List/table view with filters

**Later Phase:**
- Custom work item types and fields support
- Kanban board view (drag-and-drop columns)

**Not Planned:**
- Sprint/iteration views

### Pull Requests

**PR Creation:**
- Create PRs for any repo (local clone not required)
- Select source/target branches from remote
- Set title, description, reviewers, work item links
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

**Code Review Workflow:**
- **Immediate Feedback**: Comments posted immediately (no "Review Session" or batching)
- **Status Updates**: Manual status change (Approve, Reject, Wait) when ready
- **No Formal Start/Finish**: Fluid process without strict state transitions

**Comments:**
- **Placement**: Multi-line range selection support
- **Display**: Inline in code + Summary list under PR description
- **Interaction**: Reply directly from summary list or inline
- **Threaded**: Full support for threaded discussions
- **Markdown**: Full GitHub-style markdown support
  - Code blocks with syntax highlighting
  - Tables, lists, blockquotes
  - Inline images
  - Live preview while editing

**File Navigation:**
- **Tree View**: Hierarchical view of changed files
- **Stats**: Added/removed line counts per file
- **Keyboard**: Standard navigation (no specific jump shortcuts required)

**Policies & Status:**
- **Real-Time Integration**: Display live status of policies (builds, reviewers)
- **Visuals**: Clear pass/fail indicators
- **Constraints**: No admin override capabilities provided

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

### Pipelines

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

**Optional:**
- Edit pipeline YAML from the app

**Not Planned:**
- Pipeline variables/parameters input when triggering

### Repository Browser

**Core Features:**
- Navigate and browse code from repos
- Full-text code search with fuzzy/regex support
- Git blame view
- Shareable links to specific lines
- Commit history per file/branch
- Branch comparison

**Local Clone Integration:**
- Sync repos locally for LSP features
- Settings/button to pull/sync repos when navigating
- Dedicated managed clone directory

**Branch Operations:**
- View all branches
- Create branches
- Delete branches

**Not Planned:**
- Direct file editing/commits from browser
- Branch protection policy management (managed in Azure DevOps)

---

## Architecture & Constraints

### Environment
- **Deployment**: Locally hosted application (runs on developer's machine)
- **Single-tenant**: One organization, user's own Azure DevOps account
- **Configurable**: Organization URL, authentication tokens, and settings are user-provided

### API Compatibility
- Uses Azure DevOps REST API
- Compatible with self-hosted Azure DevOps Server instances
- Works with private organizations

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
- **Real-Time Updates**: Strategy TBD - must support:
  - Very large update streams (e.g., pipeline logs)
  - Automatic reconnection after disconnection
  - Non-intrusive disconnect handling (small icon at most, no annoying popups)
  - Low latency for LSP features

### State Management Philosophy

- **Avoid bloated libraries**: Bundle size is critical - every library is a performance tax
- **Prefer lightweight solutions**: Lean toward React Context, native hooks, or minimal libraries
- **Don't fear custom solutions**: Building our own state management is acceptable if it stays lean
- **Evaluate carefully**: Weigh benefits vs. bundle size before adding any dependency

### LSP Architecture

- **Per-Project LSP Servers**: Backend spawns LSP servers for each active project
- **User-Transparent**: LSP management is completely abstracted - "it just works"
- **No Bundled LSP Servers**: We don't bundle LSP servers
- **Auto-Detection**: Detect LSP servers from user's VS Code installation when possible
- **Auto-Install Option**: Offer to install missing LSP servers for the user's project languages
- **Communication**: Must be low-latency and resilient (WebSocket bridge via backend likely)

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

## Open Questions

> These need to be answered to complete the scope

1. **Command Palette Scope**: Confirm all searchable entity types and ranking strategy
2. **Search Backend**: Local index vs Azure DevOps Search API vs hybrid
3. **Local Clone Management**: Dedicated directory vs detect existing clones vs both
4. **LSP Languages**: Which languages to prioritize for bundled LSP servers
5. **Clone Sync Strategy**: Auto-sync vs manual vs background interval

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