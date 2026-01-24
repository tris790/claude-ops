# Phase 2: Enhanced Workflow & Developer Experience

This phase unlocks the "Power User" features, specifically bridging the gap between a web interface and a local IDE. The focus is on deep integration and responsiveness.

## 1. Local Clone Management
- [x] **Backend Git Manager**:
  - [x] Logic to manage `~/.claude-ops/repos/`.
  - [x] Background `git fetch` operations.
- [ ] **Clone UX**:
  - [ ] UI indicators for cloned vs. remote repos.
  - [ ] "Sync" buttons and status badges.
  - [ ] One-click clone actions.

## 2. LSP Intelligence (The "Secret Sauce")
- [ ] **Backend LSP Bridge**:
  - [ ] Setup architecture to spawn/manage language servers (tsserver, gopls, etc.).
  - [ ] WebSocket communication channel.
- [ ] **Frontend Integration**:
  - [ ] Connect CodeMirror to LSP events.
  - [ ] Implement Hover (Go to Definition, Type info).
  - [ ] Implement Diagnostics (Squiggles/Errors).

## 3. Interactive Code Review
- [ ] **Rich Commenting**:
  - [ ] Multi-line selection comments.
  - [ ] Markdown support in comments.
  - [ ] Threaded replies.
- [ ] **Review Submission**:
  - [ ] Draft comments status.
  - [ ] Submit Review (Approve/Reject/Wait).

## 4. Real-Time Interactions
- [ ] **Live Updates**:
  - [ ] Polling mechanism for Lists and Work Items.
  - [ ] Optimistic UI updates for user actions.
- [ ] **Pipeline Streaming**:
  - [ ] Robust log streaming integration.

## 5. Advanced Search & Command Palette
- [ ] **Deep Search**:
  - [ ] Regex support.
  - [ ] Integration with local `ripgrep` for cloned repos.
- [ ] **Advanced Filters**: specialized filters in Command Palette (`author:me`, `state:active`).
