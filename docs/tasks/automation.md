# Automation & AI Features

## 1. Overview

This document outlines the plan for integrating AI and automation capabilities into Claude-Ops. The goal is to allow users to trigger automated tasks—ranging from simple text generation to complex autonomous agent workflows—directly from the UI.
These features are powered by CLI commands (defaulting to `claude`) that can be customized by the user.

## 2. Feature Specification

### 2.1 PR Automation

#### 2.1.1 Generate PR Description
**User Story:** As a developer, I want the AI to write a comprehensive PR description based on the changes between source and target branches.

- **Trigger:** "Generate Description" button (Magic Sparks icon) in the PR Creation view or PR Edit view.
- **Functionality:**
  - Fetches the diff/commit messages between `source_branch` and `target_branch`.
  - Default Command: `claude "Write a PR description for changes between ${target_branch} and ${source_branch}. Use the following git log/diff summary: ..."`
- **Output:** populates the Description textarea.

#### 2.1.2 Intelligence-Driven Refactoring (Comment Actions)
**User Story:** As a PR author, when a reviewer leaves a comment like "optimize this loop", I want to click a button to have an AI agent apply the fix and commit it.

- **Trigger:** "Apply Fix" button (Magic Sparks icon) on a PR comment.
- **Functionality:**
  - Captures: Comment text, surrounding code context, file path.
  - Triggers a backend job.
  - Default Command: `claude "Apply the following change to file ${file_path} on branch ${branch}: '${comment_body}'. Code context: ..."`
  - **Action:** automatic commit and push to the branch.
- **UI Feedback:**
  - Button state changes to "Processing..." -> "Applied" (or "Failed").
  - UI refreshes to show the new commit/update.

### 2.2 Contextual Code Insights
**User Story:** As a developer, I want to select code in a file or diff view and ask an AI for explanation, refactoring, or security analysis.

- **Trigger:**
  - **Floating Action Popover** on text selection (reusing the "Add Comment" tooltip UI).
  - Applicable in:
    - File Browser (Read-only view)
    - PR Diff View (Side-by-side and Inline)
- **UI Interaction:**
  - **PR Diff View (Write Mode):**
    - User selects text -> "Add Comment" widget appears.
    - Inside the input box, user types their message/query.
    - **Actions:** Two submit options/buttons:
      1. **"Add Comment"**: Post as a standard PR review comment.
      2. **"Ask AI"** (Magic Sparks icon): Send text + selection context to the AI.
  - **File Browser (Read-only Mode):**
    - User selects text -> Widget appears.
    - **Label Adjustment:** The "Add Comment" label/button is replaced by **"Ask AI"** (or "Analyze").
    - **Action:** Submitting sends the query directly to the AI.
- **Functionality:**
  - Captures the message + selected code + file context.
  - Default Command: `claude "${user_message} \n\n Code context: \n ${selected_code}"`
- **Output Display:**
  - AI responses appear in a dismissible inline panel (similar to a resolved comment thread) or a dedicated "AI Assistant" sidebar, depending on user preference.

### 2.3 Autonomous "Implement Work Item" Agent
**User Story:** As a developer, I want to dispatch an autonomous agent to implement a specific Work Item from scratch.

- **Trigger:** "Implement with AI" action in the Work Item Detail view.
- **Functionality:**
  1.  **Planning Phase:** Agent reads the Work Item, searches the codebase, and creates an Implementation Plan.
  2.  **Execution Phase:** Spawns sub-agents/steps to modify files.
  3.  **Delivery Phase:** Creates a Draft PR linked to the Work Item.
- **Integration:** 
  - Uses MCP servers (e.g., Azure, Confluence) to gather context if configured.
  - Default Flow:
    - Checkout new branch `feat/wi-${id}`.
    - Analyze requirements.
    - Edit code.
    - Commit.
    - Create PR.
- **Visibility:** 
  - Progress tracker in the Work Item view (e.g., "Agent: Analyzing Codebase...", "Agent: Writing Tests...").

## 3. Architecture

### 3.1 Backend Execution (Bun)
Long-running and write-heavy operations must run on the backend to ensure stability and state persistence.

- **Job Queue:** A lightweight in-memory or SQLite-backed queue to manage agent tasks.
- **Process Management:** The backend spawns the configured CLI process (e.g., `claude`, `llm`, `scripts/agent.sh`).
- **Standard Streams:** Backend captures `stdout`/`stderr` to stream logs back to the frontend via the existing polling/streaming architecture.

### 3.2 Frontend Integration
- **Context Injection:** Frontend gathers necessary context (selection, file content, diffs) and sends it to the backend endpoint trigger.
- **User Feedback:** Toasts and status indicators for short tasks; Progress bars for long-running agents.

## 4. Configuration

A dedicated **Automation** section in the Settings page.

- **Custom Commands:**
  - Users can override the default command strings.
  - Support for template variables: `{{branch}}`, `{{file}}`, `{{selection}}`, `{{diff}}`.
  - Example Config:
    ```json
    {
      "automation": {
        "pr_description": "claude 'Summarize these changes: {{diff}}'",
        "refactor_comment": "claude 'Fix this code: {{selection}} based on {{comment}}'",
        "agent_executable": "claude"
      }
    }
    ```
- **Prompt Library:** Users can save custom prompts for the "Ask AI" context menu.

## 5. UI/UX Guidelines for Automation
- **Iconography:** Use a "Magic Sparks" icon (e.g., `Sparkles` from Lucide/Heroicons) for all AI-triggered actions.
- **transparency:** Always indicate when an action is being performed by an AI.
- **Control:** Allow users to abort long-running agent tasks.