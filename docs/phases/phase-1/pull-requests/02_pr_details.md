# Work Item: Pull Request Details (Overview)

**Feature**: Pull Requests
**Phase**: 1
**Priority**: Critical

## Objective
The landing page for a specific PR. Shows description, status checks, reviewers, and discussion.

## Requirements

### 1. Data Fetching
- **API**: `GET /_apis/git/pullrequests/{id}`.
- **Threads/Comments**: `GET /_apis/git/repositories/{repoId}/pullRequests/{id}/threads`.

### 2. UI View (`/pr/:id`)
- **Header**: Title, Status (Active/Completed), Source -> Target branch.
- **Tabs**: [Overview] [Files] [Commits].
- **Overview Tab**:
  - Description (Markdown).
  - Policies/Checks (Build status, Merge conflicts).
  - Reviewers list (with vote status).
  - Activity Feed (Comments, pushes).

### 3. Actions
- **Vote**: Approve, Approve with Suggestions, WaitForAuthor, Reject.
- **Complete**: (Phase 1 basic merge).
- **Comment**: Add general comments (not file-specific yet).

## Tasks
1. `PRDetail` layout with tabs.
2. `PolicyStatus` component (Show green/red builds).
3. `ReviewerList` component.

## Verification
- Open PR.
- See who has approved.
- See if build failed.
- Vote "Approve".
