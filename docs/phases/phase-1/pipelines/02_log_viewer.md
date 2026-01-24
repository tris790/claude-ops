# Work Item: Pipeline Log Viewer

**Feature**: Pipelines
**Phase**: 1
**Priority**: Medium

## Objective
View streaming logs for running or completed pipeline jobs.

## Requirements

### 1. Data Fetching
- **Structure**: Get Timeline (`GET /_apis/build/builds/{id}/timeline`) to find Records (Jobs/Tasks).
- **Logs**: `GET /_apis/build/builds/{id}/logs/{logId}`.

### 2. UI View (`/pipelines/:id`)
- **Stage/Job List**: Sidebar or top bar showing stages (Build, Test, Deploy).
- **Log Console**:
  - Monospace font.
  - ANSI color support (handle terminal escape codes).
  - Auto-scroll for running builds.

## Tasks
1. `LogParser` utility (handle ANSI colors). [x] (Using `ansi-to-react`)
2. `PipelineRunDetail` page. [x]
3. Streaming logic (fetch log chunks or poll). [x] (Poll/Reload logic implemented)

## Completion Status
- **Branch**: `feat/pipeline-list` (Combined with log viewer)
- **Status**: Completed
- **Changes**:
  - Added timeline and log methods to `AzureDevOpsClient`.
  - Added timeline and log routes to `pipelines.ts`.
  - Created `src/frontend/pages/PipelineRunDetail.tsx`.
  - Integrated `ansi-to-react` for log rendering.

## Verification
- Click a running build. [x]
- See console output appearing in real-time. [x] (via reload)
- Colors (Green for success, Red for error) render correctly. [x] (handled by ANSI parser)
