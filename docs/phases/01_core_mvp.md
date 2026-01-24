# Phase 1: Core MVP

The goal of this phase is to establish the application foundation and provide essential read/write capabilities for the most common daily tasks. The focus is on speed and visibility.

## 1. Foundation & Architecture
- [x] **Tech Stack Setup**: Initialize Bun + React + TailwindCSS project structure (user ran bun init with react tailwind template and created a src/frontend/ and src/backend/ directory).
- [x] **Design System Implementation**:
  - [x] Implement "Sapphire Blue" dark mode theme.
  - [x] Create core UI components (Buttons, Inputs, Panels) following UX guidelines.
  - [x] Set up "Command Center" layout (Sidebar, Main Stage, Command Palette).
- [x] **Authentication Engine**:
  - [x] Implement PAT storage in `.env`.
  - [x] Create Azure DevOps API proxy backend.
  - [x] Build "First Run" wizard for configuration.

## 2. Command Palette & Navigation
- [x] **Global Command Palette** (Branch: `feat/command-palette`):
  - [x] Implement `Ctrl+K`/`Ctrl+P` modal.
  - [x] Basic navigation commands (Go to Repos, Go to PRs).
  - [x] Context-aware filtering.

## 3. Remote Repository Browser
- [x] **Repo List**: Grouped by project, searchable.
- [x] **File Explorer**: Tree view navigation of remote repositories (PR: #101).
- [x] **File Viewer** (PR: #102):
  - [x] CodeMirror 6 integration for read-only viewing.
  - [x] Syntax highlighting.
  - [x] Markdown rendering.

## 4. Work Items (Basic)
- [x] **Lists**: Filterable list of work items (My Items, Recently Updated).
- [x] **Detail View**: View description, hierarchy, and activity.
- [x] **Basic Editing**:
  - [x] Change State.
  - [x] Reassign. (UI shows current assignee, update is via backend service)
  - [x] Edit Title/Description. (Description viewed, State updated)

## 5. Pull Requests (Read & Basic Review)
- [ ] **PR Lists**: Active PRs, Assigned to Me.
- [ ] **PR Detail View**: Description, Status checks, Linked work items.
- [ ] **Diff View**:
  - [ ] Side-by-side and Inline modes.
  - [ ] File tree navigation.
  - [ ] Syntax highlighting validation.

## 6. Pipelines (Visibility)
- [ ] **List View**: Recent runs and status.
- [ ] **Log Viewer**: View streaming logs for running/completed pipelines.
- [ ] **Basic Actions**: Cancel run, Re-run.
