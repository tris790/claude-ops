# Work Item: API Client & Types

**Feature**: Work Items
**Phase**: 1
**Priority**: High

## Objective
Establish the communication layer with Azure DevOps for fetching and updating Work Items. This is the foundational capability required for the Work Item feature.

## Requirements

### 1. TypeScript Interfaces
Define the data structures matching the Azure DevOps API (v7.0).
- **`WorkItem`**:
  - `id`: number
  - `rev`: number
  - `fields`: Key-value map (e.g., `System.Title`, `System.State`, `System.AssignedTo`).
  - `url`: string
- **`WorkItemRelation`**:
  - `rel`: string (e.g., "System.LinkTypes.Hierarchy-Forward")
  - `url`: string
  - `attributes`: map
- **`WorkItemUpdate`**: Structure for JSON Patch operations.

### 2. Service Implementation
Implement `WorkItemService` (likely in `src/backend/` or a shared `src/api/` folder depending on architecture).
- **`getIdsByQuery(wiql: string)`**:
  - Endpoint: `POST /_apis/wit/wiql`
  - Input: WIQL string.
  - Output: Array of `{ id, url }`.
- **`getDetails(ids: number[])`**:
  - Endpoint: `GET /_apis/wit/workitems?ids=...&expand=relations`
  - Input: Array of IDs.
  - Output: Array of `WorkItem` objects with all fields and relations.
- **`getTypes()`** (Optional for this specific task, but good if easy):
  - Endpoint: `GET /_apis/wit/workitemtypes`
  - Output: Metadata about states and icons.

### 3. Integration
- Ensure the service uses the existing `AzureDevOpsClient` (or equivalent proxy) to inject the PAT and handle auth.
- Verify error handling (401, 404).

## Technical Details
- **API Version**: 7.0
- **HTTP Method**: POST (for WIQL), GET (for details).
- **Headers**: standard content-type `application/json`.

## Verification
- Create a test/demo component or script that:
  1. Runs a simple query (e.g., `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project`).
  2. Fetches details for the returned IDs.
  3. Logs the output to the console.
