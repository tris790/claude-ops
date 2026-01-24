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
1. `PipelineService`.
2. `PipelineList` component.
3. `RunPipelineModal`.

## Verification
- View list.
- Click "Run".
- See new run appear in list.
