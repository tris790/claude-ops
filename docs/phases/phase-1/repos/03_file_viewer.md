# Work Item: File Viewer & CodeMirror Integration

**Feature**: Remote Repository Browser
**Phase**: 1
**Priority**: High

## Objective
Implement a high-quality read-only file viewer using CodeMirror 6, supporting syntax highlighting and Markdown rendering.

## Requirements

### 1. Data Fetching
- **Azure API**: `GET /items` with `includeContent=true`.
- **Handling Binary**: Detect images or binary files and handle gracefully (show image or "download only").

### 2. CodeMirror 6 Setup
- **Install**: `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, etc.
- **Theme**: Create a "Sapphire Dark" theme matching the app aesthetics.
- **Config**: Read-only mode, line numbers, folding.

### 3. Viewer Logic
- **Extensions**: Auto-detect language extension `lang-javascript`, `lang-python`, etc. based on file filename.
- **Markdown**: If `.md` file, render as HTML (react-markdown or similar) OR use CodeMirror in markdown mode (Decision: **Render as HTML** for READMEs, CodeMirror for editing/raw view. Default to Rendered for README).

## Tasks
1. Set up CodeMirror 6 component wrapper.
2. Implement language detection logic (extension -> language pack).
3. Implement `FileViewer` component that switches between CodeMirror (code), Image tag (images), and MarkdownRenderer (md).

## Verification
- Click `index.ts` -> see colored TypeScript code.
- Click `logo.png` -> see image.
- Click `README.md` -> see rendered Markdown.
