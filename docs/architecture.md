# Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Command    │  │    Views    │  │  Real-time  │             │
│  │  Palette    │  │  (PR/WI/    │  │  Updates    │             │
│  │             │  │  Pipeline)  │  │  Updates    │             │
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

- **Landing Page**: Repository list showing all repos in the organization
- **Command Palette**: Global search and navigation hub
- **Views**: PR, Work Items, Pipelines, Repository Browser
- **Settings Page**: Dedicated full page for configuration (org URL, PAT, clone directory, etc.)
- **Real-time Updates**: Event-driven updates via Webhooks and SignalR

### Routing

**Clean human-readable URLs** for shareable links:
- `/repos` - Repository list (**default landing/home page**)
- `/repos/:project/:repo` - Repository browser
- `/repos/:project/:repo/blob/:branch/:path` - File view
- `/pr/:id` - Pull request detail
- `/workitem/:id` - Work item detail
- `/pipelines/:id` - Pipeline detail
- `/settings` - Settings page
- `/workitems` - Work item list
- `/prs` - Pull request list
- `/pipelines` - Pipeline list

### State Management

- **Philosophy**: Minimalist. Use React Context and Hooks.
- **Global State**: Managed via custom lightweight stores where strictly necessary.
- **Avoid**: Redux, MobX, or other heavy bundle-size libraries.

### User Display

- **Avatar + name inline**: No popover cards or profile links
- Clicking users does not navigate anywhere
- @mentions in comments autocomplete with avatar + name

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
   - Runs in an isolated sidecar process
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
1. Azure DevOps events trigger backend webhooks
2. Backend broadcasts updates to connected clients
3. UI updates without full refresh
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

## Logging

- **Backend Log Level**: Errors only (minimal logging)
- Logs stored in `~/.claude-ops/logs/`
- No sensitive data (PAT, credentials) in logs

## Resolved Technical Decisions

1. **Search Strategy**: Azure DevOps Code Search API (enabled on org) + local ripgrep for cloned repos
2. **Cache Strategy**: Hybrid (event-driven invalidation + background polling)
3. **Settings Storage**: `config.json` file in app directory
4. **HTTP Proxy**: Not needed (backend makes direct calls)
5. **LSP Server Management**: Tiered discovery (System Path -> VS Code Extensions -> Managed Download). No bundling.
6. **Real-time Updates**: Event-driven architecture. Webhooks and SignalR for real-time status updates and notifications.
7. **State Management**: React Context + Custom Hooks. Avoid external state libraries (Zustand/Redux) to keep bundle small (Goal: <1MB).
