import { azureClient } from "../services/azure";

function getPrId(req: Request, params: any): string {
    // Bun.serve passes (req, server) as arguments. 'params' here might be the Server object, not route params.
    // We should rely on URL parsing or check if params matches what we expect.

    // Debug log to confirm hypothesis (can be removed later)
    // console.log("getPrId params:", params);

    // Try parsing from URL first as it is most reliable given the middleware/router uncertainty
    try {
        const url = new URL(req.url);
        // Match /api/prs/123 or /prs/123
        const match = url.pathname.match(/\/prs\/(\d+)/);
        if (match && match[1]) return match[1];
    } catch (e) {
        console.error("Error parsing PR ID:", e);
    }

    // Fallback to params if looks like a simple ID (numeric string or number)
    if (params && params.id && (typeof params.id === 'string' || typeof params.id === 'number')) {
        // simplistic check to avoid Server object which might have an id but it's weird
        if (String(params.id).match(/^\d+$/)) {
            return String(params.id);
        }
    }

    return "";
}

export const prRoutes = {
    // -------------------------------------------------------------------------
    // List Pull Requests (Global or Project-scoped)
    // -------------------------------------------------------------------------
    "/api/prs": {
        async GET(req: Request) {
            const url = new URL(req.url);

            const criteria: any = {
                status: url.searchParams.get("status") || "active",
                creatorId: url.searchParams.get("creatorId") || undefined,
                reviewerId: url.searchParams.get("reviewerId") || undefined,
                project: url.searchParams.get("project") || undefined,
                repositoryId: url.searchParams.get("repoId") || undefined
            };

            const debugInfo = `status=${criteria.status} project=${criteria.project || 'ALL'}`;
            console.log(`[API] Fetching PRs (${debugInfo})...`);

            try {
                // azureClient.getPullRequests now handles iterating all projects if 'project' is missing
                const prs = await azureClient.getPullRequests(criteria);
                console.log(`[API] Found ${prs.length} PRs`);
                return Response.json(prs);
            } catch (error: any) {
                console.error("[API] Error fetching PRs:", error);
                return Response.json({
                    error: "Failed to fetch PRs",
                    details: error.message
                }, { status: 500 });
            }
        },
    },

    // -------------------------------------------------------------------------
    // Get Single Pull Request
    // -------------------------------------------------------------------------
    "/api/prs/:id": {
        async GET(req: Request, params: any) {
            const id = getPrId(req, params);
            if (!id) return Response.json({ error: "Invalid PR ID" }, { status: 400 });

            const url = new URL(req.url);
            // We accept both repoId and project as context hints
            const repoId = url.searchParams.get("repoId");
            const project = url.searchParams.get("project");

            console.log(`[API] Fetching PR ${id} (Context: repo=${repoId}, proj=${project})`);

            try {
                // Now supports project context and auto-search fallback in service
                const pr = await azureClient.getPullRequest(id, repoId || undefined, project || undefined);
                return Response.json(pr);
            } catch (error: any) {
                console.error(`[API] Error fetching PR ${id}:`, error.message);
                return Response.json({
                    error: `Failed to fetch PR ${id}`,
                    details: error.message
                }, { status: 500 }); // Or 404 if not found
            }
        }
    },

    // -------------------------------------------------------------------------
    // Get PR Threads
    // -------------------------------------------------------------------------
    "/api/prs/:id/threads": {
        async GET(req: Request, params: any) {
            const id = getPrId(req, params);
            if (!id) return Response.json({ error: "Invalid PR ID" }, { status: 400 });

            // We need repo/project context for threads usually
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");

            // Note: Threads API usually requires Repo ID. It's strictly nested.
            if (!repoId) {
                // If we don't have repoId, we can't fetch threads easily without first fetching the PR to get the repoId
                // But for now, let's error if missing, or try to enable a lookup if critical.
                return Response.json({ error: "repoId is required for fetching threads" }, { status: 400 });
            }

            try {
                const threads = await azureClient.getPullRequestThreads(repoId, id);
                return Response.json(threads);
            } catch (error: any) {
                console.error(`[API] Error fetching threads for PR ${id}:`, error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
        async POST(req: Request, params: any) {
            const id = getPrId(req, params);
            if (!id) return Response.json({ error: "Invalid PR ID" }, { status: 400 });

            try {
                const body = await req.json();
                const { repoId, content } = body;

                if (!repoId || !content) {
                    return Response.json({ error: "Missing required fields (repoId, content)" }, { status: 400 });
                }

                const thread = await azureClient.createPullRequestThread(repoId, id, content);
                return Response.json(thread);
            } catch (error: any) {
                console.error(`[API] Error creating thread for PR ${id}:`, error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },

    // -------------------------------------------------------------------------
    // Vote on PR
    // -------------------------------------------------------------------------
    "/api/prs/:id/vote": {
        async POST(req: Request, params: any) {
            const id = getPrId(req, params);
            if (!id) return Response.json({ error: "Invalid PR ID" }, { status: 400 });

            try {
                const body = await req.json();
                const { repoId, reviewerId, vote } = body;

                if (!repoId || !reviewerId || vote === undefined) {
                    return Response.json({ error: "Missing required fields" }, { status: 400 });
                }

                const result = await azureClient.votePullRequest(repoId, id, reviewerId, vote);
                return Response.json(result);
            } catch (error: any) {
                console.error(`[API] Error voting on PR ${id}:`, error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },

    // -------------------------------------------------------------------------
    // Get PR Changes
    // -------------------------------------------------------------------------
    "/api/prs/:id/changes": {
        async GET(req: Request, params: any) {
            const id = getPrId(req, params);
            if (!id) return Response.json({ error: "Invalid PR ID" }, { status: 400 });

            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");

            if (!repoId) return Response.json({ error: "repoId is required for changes" }, { status: 400 });

            try {
                const changes = await azureClient.getPullRequestChanges(repoId, id);
                return Response.json(changes);
            } catch (error: any) {
                console.error(`[API] Error fetching changes for PR ${id}:`, error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },

    // -------------------------------------------------------------------------
    // Get PR Commits
    // -------------------------------------------------------------------------
    "/api/prs/:id/commits": {
        async GET(req: Request, params: any) {
            const id = getPrId(req, params);
            if (!id) return Response.json({ error: "Invalid PR ID" }, { status: 400 });

            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");

            if (!repoId) return Response.json({ error: "repoId is required for commits" }, { status: 400 });

            try {
                const commits = await azureClient.getPullRequestCommits(repoId, id);
                return Response.json(commits);
            } catch (error: any) {
                console.error(`[API] Error fetching commits for PR ${id}:`, error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    }
};
