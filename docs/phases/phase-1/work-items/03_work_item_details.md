# Work Item: Work Item Details & Editing

**Feature**: Work Items
**Phase**: 1
**Priority**: High

## Objective
View full details of a work item and perform basic updates (State, Assignee, Comments).

## Requirements

### 1. UI View (`/workitems/:id`)
- **Header**: ID, Title, State (dropdown), Assigned To (dropdown).
- **Body**:
  - **Description**: Rendered HTML (Azure DevOps uses HTML for descriptions).
  - **Details Pane** (Right side): Priority, Area Path, Iteration, Tags.
  - **Discussion/Comments**: Threaded view at bottom.

### 2. Editing Actions
- **State Change**: PATCH Update `System.State`.
- **Reassign**: PATCH Update `System.AssignedTo`.
- **Edit Description**: WYSIWYG or Markdown-to-HTML editor. (Azure stores HTML, so we might need a basic HTML editor or treat as text). *Decision*: Use a lightweight rich text editor or just `contenteditable` for V1.
- **Add Comment**: POST to comments endpoint.

## Tasks
1. Build `WorkItemDetail` layout.
2. Implement `WorkItemUpdateService` (PATCH construction).
3. Build `CommentFeed` component.

## Verification
- Open a bug.
- Change state from "New" to "Active". -> UI updates immediately.
- Add a comment "Looking into this". -> Appears in feed.
