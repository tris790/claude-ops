# Work Item: Work Item Lists & Filters

**Feature**: Work Items
**Phase**: 1
**Priority**: High

## Objective
Display list of work items based on queries, enabling users to find their tasks quickly.

## Requirements

### 1. Data Source
- Uses `WorkItemService.getIdsByQuery` (defined in Item 01).
- **WIQL Queries**:
  - "My Items": `AssignedTo = @Me`
  - "Recently Updated": `Order By ChangedDate Desc`

### 2. UI View (`/workitems`)
- **Table/List**:
  - Columns: ID, Type (Icon), Title, State, Assigned To.
  - Compact density (so we can see many).
- **Filters**:
  - "Presets" buttons at top: [Assigned to Me] [Mentioned] [Following].
  - Text filter (filters currently loaded list).
- **Paging**: Azure returns pages. Implement infinite scroll or "Load More".

## Tasks
1. Build `WorkItemList` component.
2. Implement the WIQL queries for the standard filters.
3. Design the Work Item rows (State colors are important - Active=Blue, Resolved=Green, etc.).

## Verification
- Navigate to `/workitems`.
- See "Assigned to Me" selected by default.
- See list of items.
- Click item -> Navigates to detail.
