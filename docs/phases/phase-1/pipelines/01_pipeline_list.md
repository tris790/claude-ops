# Work Item: Pipeline List & Actions

**Feature**: Pipelines
**Phase**: 1
**Priority**: Medium

## Objective
View recent pipeline runs to check build status.

## Requirements

### 1. Data Fetching
- **API**: `GET /_apis/build/builds` and `GET /_apis/pipelines`.

### 2. UI View (`/pipelines`)
- **List**:
  - Name, Status (Running, Passed, Failed), Branch, Triggered By, Time.
  - Live updates (Polling).
- **Actions**:
  - "Run Pipeline": Button to trigger a new run (select branch).
  - "Cancel": Stop a running build.

## Tasks
1. `PipelineService`. [x]
2. `PipelineList` component. [x]
3. `RunPipelineModal`. [x] (Implemented via prompt for branch in List view)

## Completion Status
- **Branch**: `feat/pipeline-list`
- **Status**: Completed
- **Changes**:
  - Added pipeline and run methods to `AzureDevOpsClient`.
  - Created `src/backend/routes/pipelines.ts`.
  - Created `src/frontend/api/pipelines.ts`.
  - Created `src/frontend/pages/PipelineList.tsx`.
  - Updated `src/frontend/App.tsx` with `/pipelines` route.

## Verification
- View list. [x]
- Click "Run". [x]
- See new run appear in list. [x]
