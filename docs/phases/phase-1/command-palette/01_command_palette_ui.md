# Work Item: Command Palette UI

**Feature**: Command Palette
**Phase**: 1
**Priority**: High

## Objective
Create the global Command Palette modal, the user's primary navigation tool ("The Heart" of the UX). It must be accessible via `Ctrl+K` / `Ctrl+P` and support keyboard-centric interaction.

## Requirements

### 1. UI Component
- **Modal**: Centered, top-third placement.
- **Glassmorphism**: `backdrop-blur-md bg-zinc-900/80` (per UX guidelines).
- **Input**: Large, focus-ring free (or subtle), auto-focused.
- **List**: Virtualized list of results.
- **Selection**: Arrow keys to navigate, Enter to select.
- **Icons**: Distinct icons for Repos, Files, PRs, Work Items.

### 2. State & Invocation
- **Global Shortcut**: Listen for `Ctrl+K` (and `Cmd+K` on Mac), `Ctrl+P`.
- **Context Awareness**: Pass current page context (optional for V1, but good for "Project Scope" ranking).

### 3. Basic "Static" Commands
- **Navigation**: "Go to Repos", "Go to PRs", "Settings".
- **Theme**: "Toggle Theme".

## Tasks
1. Install `cmdk` (optional, but excellent for this) or build a custom React implementation using standard inputs/lists. *Recommendation*: Use `cmdk` (Radix UI) or similar lightweight accessible library if allowed, else custom. *Decision*: Build custom or use lightweight headless UI to avoid deps excessive weight, but `cmdk` is very standard for this. Let's assume custom for "Minimalist" goal unless it's too hard.
2. Implement the `CommandPalette` component.
3. Hook up global key listeners in `App.tsx` or `MainLayout`.

## Verification
- Press `Ctrl+K` anywhere in the app -> Palette opens.
- Type "Set" -> see "Settings".
- Arrow down + Enter -> Navigates to `/settings`.
- Escape -> Closes palette.
