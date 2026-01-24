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
1. `LogParser` utility (handle ANSI colors).
2. `PipelineRunDetail` page.
3. Streaming logic (fetch log chunks or poll).

## Verification
- Click a running build.
- See console output appearing in real-time.
- Colors (Green for success, Red for error) render correctly.
