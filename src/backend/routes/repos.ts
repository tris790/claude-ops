import { azureClient } from "../services/azure";
import { gitService } from "../services/git";

export const repoRoutes = {
    "/api/repos": {
        async GET(req: Request) {
            try {
                const [repos, clonedRepos] = await Promise.all([
                    azureClient.getRepositories(),
                    gitService.listClonedRepos()
                ]);

                // Create a set of cloned identifiers "project/repo"
                const clonedSet = new Set(clonedRepos.map(r => `${r.project}/${r.repo}`));

                const reposWithStatus = repos.map((repo: any) => ({
                    ...repo,
                    isCloned: clonedSet.has(`${repo.project.name}/${repo.name}`)
                }));

                return Response.json(reposWithStatus);
            } catch (error: any) {
                console.error("Error fetching repos:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/repos/clone": {
        async POST(req: Request) {
            try {
                const { projectName, repoName, remoteUrl } = await req.json();
                if (!projectName || !repoName || !remoteUrl) {
                    return Response.json({ error: "Missing required fields" }, { status: 400 });
                }

                let cloneUrl = remoteUrl;
                const pat = process.env.AZURE_DEVOPS_PAT;

                if (pat) {
                    try {
                        const urlObj = new URL(remoteUrl);
                        urlObj.username = "user"; // Azure DevOps accepts any username with PAT
                        urlObj.password = pat;
                        cloneUrl = urlObj.toString();
                    } catch (e) {
                        console.warn("Failed to inject PAT into clone URL, using original URL", e);
                    }
                }

                await gitService.clone(projectName, repoName, cloneUrl);
                return Response.json({ success: true });
            } catch (error: any) {
                console.error("Error cloning repo:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/repos/sync": {
        async POST(req: Request) {
            try {
                const { projectName, repoName } = await req.json();
                if (!projectName || !repoName) {
                    return Response.json({ error: "Missing required fields" }, { status: 400 });
                }

                await gitService.pull(projectName, repoName);
                return Response.json({ success: true });
            } catch (error: any) {
                console.error("Error syncing repo:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/repo-items": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");
            const path = url.searchParams.get("path") || "/";
            const version = url.searchParams.get("version");
            const versionType = url.searchParams.get("versionType") || "branch";

            if (!repoId) {
                return Response.json({ error: "Missing repoId" }, { status: 400 });
            }

            try {
                const items = await azureClient.getRepoItems(repoId, path, version || undefined, versionType);
                return Response.json(items);
            } catch (error: any) {
                console.error("Error fetching repo items:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/repos/branches": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");
            if (!repoId) return Response.json({ error: "Missing repoId" }, { status: 400 });

            try {
                const branches = await azureClient.getBranches(repoId);
                return Response.json(branches);
            } catch (error: any) {
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/repo-content": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");
            const path = url.searchParams.get("path");
            const version = url.searchParams.get("version");
            const versionType = url.searchParams.get("versionType") || "branch";

            if (!repoId || !path) {
                return Response.json({ error: "Missing repoId or path" }, { status: 400 });
            }

            try {
                const content = await azureClient.getFileContent(repoId, path, version || undefined, versionType);
                return Response.json({ content });
            } catch (error: any) {
                console.error("Error fetching repo content:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
};
