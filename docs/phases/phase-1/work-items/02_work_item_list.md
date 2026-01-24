# Work Item: Work Item Lists & Filters

**Feature**: Work Items
**Phase**: 1
**Priority**: High

## Objective
Display list of work items based on queries, enabling users to find their tasks quickly.

## Requirements

### 1. Data Source [x]
- Uses `WorkItemService.getIdsByQuery`. [x]
- **WIQL Queries**: [x]
  - "My Items": `AssignedTo = @Me` [x]
  - "Recently Updated": `Order By ChangedDate Desc` [x]

### 2. UI View (`/workitems`) [x]
- **Table/List**: [x]
  - Columns: ID, Type (Icon), Title, State, Assigned To. [x]
  - Compact density (so we can see many).
- **Filters**: [x]
  - "Presets" buttons: [Assigned to Me] [Recently Updated]. [x]
  - Text filter (filters currently loaded list).
- **Paging**: Basic list implemented. [x]

## Tasks
1. Build `WorkItemList` component. [x]
2. Implement the WIQL queries for the standard filters. [x]
3. Design the Work Item rows. [x]

## Completion Status
- **Branch**: `feat/work-items-list`
- **Status**: Completed
- **Changes**:
  - Created `src/frontend/pages/WorkItems.tsx`
  - Updated `src/frontend/App.tsx` with `/workitems` route
  - Updated `src/frontend/layouts/MainLayout.tsx` with sidebar navigation

## Verification
- Navigate to `/workitems`.
- See "Assigned to Me" selected by default.
- See list of items.
- Click item -> Navigates to detail.
