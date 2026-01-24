# Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Command    │  │    Views    │  │  Real-time  │             │
│  │  Palette    │  │  (PR/WI/    │  │  Updates    │             │
│  │             │  │  Pipeline)  │  │  (Polling)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend (Bun)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  API Proxy  │  │  Clone      │  │  LSP        │             │
│  │  (Azure     │  │  Manager    │  │  Bridge     │             │
│  │  DevOps)    │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
│  Azure DevOps   │  │  Local      │  │  LSP Servers    │
│  REST API       │  │  Git Clones │  │  (per language) │
└─────────────────┘  └─────────────┘  └─────────────────┘
```

## Frontend

**Tech Stack**: Bun, React, TailwindCSS, TypeScript

### Key Components

- **Command Palette**: Global search and navigation hub
- **Views**: PR, Work Items, Pipelines, Repository Browser
- **Settings Page**: Dedicated full page for configuration (org URL, PAT, clone directory, etc.)
- **Real-time Updates**: Polling-based updates for in-view content

### State Management

- TBD: Consider Zustand, Jotai, or React Query for server state

### Routing

- TBD: React Router or TanStack Router

## Backend

**Tech Stack**: Bun

### Responsibilities

1. **API Proxy**: Forwards requests to Azure DevOps REST API
   - Handles authentication (PAT injection)
   - Request caching where appropriate
   - Rate limiting awareness

2. **Clone Manager**: Manages local git repositories
   - Dedicated directory: `~/.claude-ops/repos/`
   - Clone, fetch, pull operations
   - Repository metadata tracking

3. **LSP Bridge**: Manages language server connections
   - Spawns LSP servers on demand
   - Routes LSP requests from frontend
   - Handles multiple language servers

## Data Flow

### Authentication
```
User provides PAT → Stored in .env file → Injected into Azure DevOps API calls
```

### Code Navigation (with LSP)
```
1. User opens file in repo browser
2. Backend checks if repo is cloned locally
3. If not cloned, prompt to sync
4. Once cloned, LSP server spawned for file type
5. LSP requests routed through backend
6. Results returned to frontend for display
```

### Real-time Updates
```
1. Frontend polls backend at intervals (when view is active)
2. Backend queries Azure DevOps API
3. Diff compared to cached state
4. Only changed data sent to frontend
5. UI updates without full refresh
```

## Local Storage Structure

```
~/.claude-ops/
├── config.json          # User settings, org URL, etc.
├── repos/
│   ├── project-a/
│   │   └── repo-1/      # Cloned repository
│   └── project-b/
│       └── repo-2/
├── cache/
│   └── ...              # API response cache
└── logs/
    └── ...              # Application logs

# In application directory:
.env                      # PAT and other secrets (gitignored)
```

## Security Considerations

- PAT stored in `.env` file (gitignored, local only)
- No PAT exposed to frontend (backend injects on API calls)
- All Azure DevOps API calls routed through backend proxy
- Local clones respect Azure DevOps permissions

## Open Technical Decisions

1. **Search Index**: Local ripgrep vs Azure Search API vs hybrid
2. **LSP Server Management**: Bundle servers vs expect system install
3. **Cache Strategy**: What to cache, TTL, invalidation
4. **WebSocket vs Polling**: For real-time updates
