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
1. `PRDetail` layout with tabs. [x]
2. `PolicyStatus` component (Show green/red builds). [x]
3. `ReviewerList` component. [x]

## Completion Status
- **Branch**: `feat/pr-details`
- **Status**: Completed
- **Changes**:
  - Updated `src/backend/services/azure.ts` with `getPullRequest`, `getPullRequestThreads`, `votePullRequest`.
  - Updated `src/backend/routes/prs.ts` with detail, threads, and vote endpoints.
  - Updated `src/frontend/api/prs.ts` with matching frontend functions.
  - Created `src/frontend/pages/PRDetail.tsx`.
  - Updated `src/frontend/App.tsx` and `src/frontend/pages/PullRequests.tsx` for navigation.

## Verification
- Open PR. [x]
- See who has approved. [x]
- See if build failed. [x]
- Vote "Approve". [x] (Backend implemented, UI feedback added)
