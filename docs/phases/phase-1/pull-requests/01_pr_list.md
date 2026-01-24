# Work Item: Pull Request Lists

**Feature**: Pull Requests
**Phase**: 1
**Priority**: High

## Objective
Display active pull requests to help users track code reviews.

## Requirements

### 1. Data Fetching [x]
- **API**: `GET /_apis/git/pullrequests`. [x]
- **Filters**: Basic status filtering implemented. [x]

### 2. UI View (`/prs`) [x]
- **List Layout**: [x]
  - Title, ID, Repository, Author, Created Date. [x]
  - **Vote Status**: Icons for reviewers implemented. [x]
- **Grouping**: Tabs for status (Active, Completed, Abandoned). [x]

## Tasks
1. `PRService.getPullRequests(criteria)`. [x]
2. `PRList` component. [x]
3. Vote status visualizer. [x]

## Completion Status
- **Branch**: `feat/pr-list`
- **Status**: Completed
- **Changes**:
  - Updated `src/backend/services/azure.ts` with `getPullRequests`
  - Created `src/backend/routes/prs.ts`
  - Updated `src/backend/index.ts` to register PR routes
  - Created `src/frontend/api/prs.ts`
  - Created `src/frontend/pages/PullRequests.tsx`
  - Updated `src/frontend/App.tsx` with `/prs` route

## Verification
- Go to `/prs`.
- See PRs created by me.
- See PRs assigned to me.
