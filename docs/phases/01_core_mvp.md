# Phase 1: Core MVP

The goal of this phase is to establish the application foundation and provide essential read/write capabilities for the most common daily tasks. The focus is on speed and visibility.

## 1. Foundation & Architecture
- **Tech Stack Setup**: Initialize Bun + React + TailwindCSS project structure (user ran bun init with react tailwind template and created a src/frontend/ and src/backend/ directory).
- **Design System Implementation**:
  - Implement "Sapphire Blue" dark mode theme.
  - Create core UI components (Buttons, Inputs, Panels) following UX guidelines.
  - Set up "Command Center" layout (Sidebar, Main Stage, Command Palette).
- **Authentication Engine**:
  - Implement PAT storage in `.env`.
  - Create Azure DevOps API proxy backend.
  - Build "First Run" wizard for configuration.

## 2. Command Palette & Navigation
- **Global Command Palette**:
  - Implement `Ctrl+K`/`Ctrl+P` modal.
  - Basic navigation commands (Go to Repos, Go to PRs).
  - Context-aware filtering.

## 3. Remote Repository Browser
- **Repo List**: Grouped by project, searchable.
- **File Explorer**: Tree view navigation of remote repositories.
- **File Viewer**:
  - CodeMirror 6 integration for read-only viewing.
  - Syntax highlighting.
  - Markdown rendering.

## 4. Work Items (Basic)
- **Lists**: Filterable list of work items (My Items, Recently Updated).
- **Detail View**: View description, hierarchy, and activity.
- **Basic Editing**:
  - Change State.
  - Reassign.
  - Edit Title/Description.

## 5. Pull Requests (Read & Basic Review)
- **PR Lists**: Active PRs, Assigned to Me.
- **PR Detail View**: Description, Status checks, Linked work items.
- **Diff View**:
  - Side-by-side and Inline modes.
  - File tree navigation.
  - Syntax highlighting validation.

## 6. Pipelines (Visibility)
- **List View**: Recent runs and status.
- **Log Viewer**: View streaming logs for running/completed pipelines.
- **Basic Actions**: Cancel run, Re-run.
