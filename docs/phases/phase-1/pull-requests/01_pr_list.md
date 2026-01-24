# Work Item: Pull Request Lists

**Feature**: Pull Requests
**Phase**: 1
**Priority**: High

## Objective
Display active pull requests to help users track code reviews.

## Requirements

### 1. Data Fetching
- **API**: `GET /_apis/git/pullrequests`.
- **Filters**:
  - `searchCriteria.status=active`
  - `searchCriteria.reviewerId=@me` (Assigned to Me)
  - `searchCriteria.creatorId=@me` (Created by Me)

### 2. UI View (`/prs`)
- **List Layout**:
  - Title, ID, Repository, Author, Created Date.
  - **Vote Status**: Show icons if reviewers have approved/rejected.
- **Grouping**: "Mine" vs "Active" vs "Completed".

## Tasks
1. `PRService.getPullRequests(criteria)`.
2. `PRList` component.
3. Vote status visualizer (Green check, Red X, etc.).

## Verification
- Go to `/prs`.
- See PRs created by me.
- See PRs assigned to me.
