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
};
