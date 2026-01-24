# Work Item: Work Item Details & Editing

**Feature**: Work Items
**Phase**: 1
**Priority**: High

## Objective
View full details of a work item and perform basic updates (State, Assignee, Comments).

## Requirements

### 1. UI View (`/workitems/:id`) [x]
- **Header**: ID, Title, State (dropdown), Assigned To (static). [x]
- **Body**: [x]
  - **Description**: Rendered HTML. [x]
  - **Details Pane**: Priority, Area Path, Iteration. [x]
  - **Discussion/Comments**: Basic comment input implemented. [x]

### 2. Editing Actions [x]
- **State Change**: PATCH Update `System.State`. [x]
- **Add Comment**: POST to comments endpoint. [x]

## Tasks
1. Build `WorkItemDetail` layout. [x]
2. Implement `WorkItemUpdateService`. [x]
3. Build `CommentFeed` (Basic POST implemented). [x]

## Completion Status
- **Branch**: `feat/work-items-detail`
- **Status**: Completed
- **Changes**:
  - Updated `src/backend/services/azure.ts` with PATCH and Comment methods
  - Updated `src/backend/services/work-items.ts` with update and comment methods
  - Updated `src/backend/routes/work-items.ts` with PATCH and POST routes
  - Updated `src/frontend/api/work-items.ts` with frontend clients
  - Created `src/frontend/pages/WorkItemDetail.tsx`
  - Updated `src/frontend/App.tsx` with `/workitems/:id` route
  - Updated `src/frontend/pages/WorkItems.tsx` to link to details

## Verification
- Open a bug.
- Change state from "New" to "Active". -> UI updates immediately.
- Add a comment "Looking into this". -> Appears in feed.
