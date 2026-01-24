# Work Item: Project Structure & Foundation

**Feature**: Foundation
**Phase**: 1
**Priority**: Critical

## Objective
Verify and solidify the initial project structure, ensuring the tech stack (Bun, React, TailwindCSS) is correctly configured and the folder structure supports the modular architecture described in `docs/architecture.md`.

## Requirements

### 1. Tech Stack Verification
- **Runtime**: Ensure `bun` is managing dependencies (no npm/yarn).
- **Frontend**: React (managed by Bun).
- **Styling**: TailwindCSS configured with a custom `index.css`.
- **Backend**: Bun server `Bun.serve`.

### 2. Directory Structure
Refactor/Ensure the following structure exists:

```
src/
├── frontend/
│   ├── components/      # Shared UI components (Button, Input, etc.)
│   ├── layouts/         # Layout shells (MainLayout, AuthLayout)
│   ├── pages/           # Page components (routed)
│   ├── hooks/           # Custom React hooks
│   ├── contexts/        # React contexts (Theme, Auth, etc.)
│   ├── api/             # API client integration
│   ├── utils/           # Helper functions
│   ├── App.tsx
│   └── main.tsx
├── backend/
│   ├── index.ts         # Server entry point
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic (AzureProxy, CloneManager)
│   └── types/           # Shared types (if monorepo style) or backend-specific
└── shared/              # Types shared between FE and BE
    └── types.ts
```

### 3. Configuration
- **Tailwind**: accessible in `src/frontend/index.css`.

## Tasks
1. Verify `package.json` scripts (`dev`, `build`).
2. Create/Organize the folder structure in `src/`.

## Verification
- `bun dev` starts both frontend and backend (or user knows to run them).
- Accessing `localhost:PORT` loads the React app.
