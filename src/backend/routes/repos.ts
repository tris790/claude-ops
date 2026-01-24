import { azureClient } from "../services/azure";

export const repoRoutes = {
    "/api/repos": {
        async GET(req: Request) {
            try {
                const repos = await azureClient.getRepositories();
                return Response.json(repos);
            } catch (error: any) {
                console.error("Error fetching repos:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/repo-items": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");
            const path = url.searchParams.get("path") || "/";

            if (!repoId) {
                return Response.json({ error: "Missing repoId" }, { status: 400 });
            }

            try {
                const items = await azureClient.getRepoItems(repoId, path);
                return Response.json(items);
            } catch (error: any) {
                console.error("Error fetching repo items:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/repo-content": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");
            const path = url.searchParams.get("path");

            if (!repoId || !path) {
                return Response.json({ error: "Missing repoId or path" }, { status: 400 });
            }

            try {
                const content = await azureClient.getFileContent(repoId, path);
                return Response.json({ content });
            } catch (error: any) {
                console.error("Error fetching repo content:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
};
