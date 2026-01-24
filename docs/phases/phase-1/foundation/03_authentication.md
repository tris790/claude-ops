# Work Item: Authentication Engine

**Feature**: Foundation
**Phase**: 1
**Priority**: High

## Objective
Implement the authentication mechanism using Personal Access Tokens (PAT) stored in the `.env` file, and create the First Run Wizard for initial configuration.

## Requirements

### 1. Backend: Auth & Proxy
- **Env Storage**: Backend reads `AZURE_DEVOPS_PAT` and `AZURE_DEVOPS_ORG_URL` from `.env` (or a secure config file in `~/.claude-ops/config.json`). *Correction based on Architecture Goals*: `docs/goals.md` says `.env` in application directory is the primary mechanism, but `config.json` is for settings. Let's stick to `.env` for secrets as per doc.
- **Request Injection**: Middleware to inject the Basic Auth header (PAT) into outgoing requests to Azure DevOps.
- **Validation Endpoint**: `POST /api/auth/validate` to test credentials.

### 2. Frontend: Auth Context
- **AuthContext**: manage `isAuthenticated`, `userProfile`.
- **Protected Route**: Redirect to `/setup` if no valid credential is found.

### 3. First Run Wizard (`/setup`)
- **UI**: A clean, centered form.
- **Inputs**:
  - Organization URL (e.g., `https://dev.azure.com/myorg`).
  - Personal Access Token.
- **Action**: "Connect".
  - Calls `POST /api/setup` (or similar).
  - Backend writes to `.env` (if running locally) or validates. *Note*: Writing to `.env` from the running app might be tricky depending on permissions, but usually fine in this local-app context.
- **Feedback**: Show success/fail. On success, redirect to `/repos`.

## Tasks
1. Implement Backend mechanism to read/write `.env` (or `config.json` if we decide strictly against `.env` modification at runtime, but `.env` is requested).
2. Create `AuthContext` in Frontend.
3. Build the `/setup` page.
4. Implement the API Proxy logic (using `fetch` in backend) that adds the Authorization header.

## Verification
- Start app without `.env`.
- User is redirected to `/setup`.
- Enter valid PAT and Org URL.
- App connects, saves config, and redirects to Home.
- Subsequent restarts track authentication automatically.
