import { azureClient } from "../services/azure";

export const prRoutes = {
    "/api/prs": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const status = url.searchParams.get("status") || "active";
            const creatorId = url.searchParams.get("creatorId");
            const reviewerId = url.searchParams.get("reviewerId");

            try {
                const prs = await azureClient.getPullRequests({ status, creatorId, reviewerId });
                return Response.json(prs);
            } catch (error: any) {
                console.error("Error fetching PRs:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/prs/:id": {
        async GET(req: Request, params: any) {
            const { id } = params;
            try {
                const pr = await azureClient.getPullRequest(id);
                return Response.json(pr);
            } catch (error: any) {
                console.error("Error fetching PR detail:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/prs/:id/threads": {
        async GET(req: Request, params: any) {
            const { id } = params;
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");
            if (!repoId) return Response.json({ error: "repoId is required" }, { status: 400 });

            try {
                const threads = await azureClient.getPullRequestThreads(repoId, id);
                return Response.json(threads);
            } catch (error: any) {
                console.error("Error fetching PR threads:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/prs/:id/vote": {
        async POST(req: Request, params: any) {
            const { id } = params;
            const body = await req.json();
            const { repoId, reviewerId, vote } = body;

            if (!repoId || !reviewerId || vote === undefined) {
                return Response.json({ error: "Missing required fields" }, { status: 400 });
            }

            try {
                const result = await azureClient.votePullRequest(repoId, id, reviewerId, vote);
                return Response.json(result);
            } catch (error: any) {
                console.error("Error voting on PR:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/prs/:id/changes": {
        async GET(req: Request, params: any) {
            const { id } = params;
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");
            if (!repoId) return Response.json({ error: "repoId is required" }, { status: 400 });

            try {
                const changes = await azureClient.getPullRequestChanges(repoId, id);
                return Response.json(changes);
            } catch (error: any) {
                console.error("Error fetching PR changes:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    }
};
