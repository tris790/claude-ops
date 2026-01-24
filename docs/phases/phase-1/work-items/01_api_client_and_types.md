# Work Item: API Client & Types

**Feature**: Work Items
**Phase**: 1
**Priority**: High

## Objective
Establish the communication layer with Azure DevOps for fetching and updating Work Items. This is the foundational capability required for the Work Item feature.

## Requirements

### 1. TypeScript Interfaces [x]
Define the data structures matching the Azure DevOps API (v7.0).
- **`WorkItem`** [x]
- **`WorkItemRelation`** [x]
- **`WorkItemUpdate`** [x]

### 2. Service Implementation [x]
Implement `WorkItemService`.
- **`getIdsByQuery(wiql: string)`** [x]
- **`getDetails(ids: number[])`** [x]
- **`getTypes()`** (Skipped for now as it was optional)

### 3. Integration [x]
- Ensure the service uses the existing `AzureDevOpsClient`. [x]
- Verify error handling (401, 404). [x]

## Completion Status
- **Branch**: `feat/work-items-api`
- **Status**: Completed
- **Changes**:
  - Created `src/backend/types/work-items.ts`
  - Updated `src/backend/services/azure.ts` with WIQL and Work Item detail methods
  - Created `src/backend/services/work-items.ts`
  - Created `src/backend/routes/work-items.ts`
  - Updated `src/backend/index.ts` to register new routes
  - Created `src/frontend/api/work-items.ts`

## Technical Details
- **API Version**: 7.0
- **HTTP Method**: POST (for WIQL), GET (for details).
- **Headers**: standard content-type `application/json`.

## Verification
- Create a test/demo component or script that:
  1. Runs a simple query (e.g., `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project`).
  2. Fetches details for the returned IDs.
  3. Logs the output to the console.
