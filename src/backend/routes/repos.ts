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
    "/api/repos/search": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const repoId = url.searchParams.get("repoId");
            const project = url.searchParams.get("project");
            const repo = url.searchParams.get("repo");
            const query = url.searchParams.get("query");

            if (!query) {
                return Response.json({ error: "Missing query" }, { status: 400 });
            }

            try {
                let targetProject = "";
                let targetRepo = "";

                if (project && repo) {
                    targetProject = project;
                    targetRepo = repo;
                } else if (repoId) {
                    const repoInfo = await azureClient.getRepositoryById(repoId);
                    if (repoInfo && repoInfo.project && repoInfo.name) {
                        targetProject = repoInfo.project.name;
                        targetRepo = repoInfo.name;
                    }
                } else {
                    return Response.json({ error: "Missing repo context" }, { status: 400 });
                }

                if (targetProject && targetRepo) {
                    if (await gitService.isCloned(targetProject, targetRepo)) {
                        const isRegex = url.searchParams.get("isRegex") === "true";
                        const searchType = url.searchParams.get("type"); // "path" or "content" (default)
                        const contextLines = parseInt(url.searchParams.get("context") || "2", 10);
                        const filePatterns = url.searchParams.getAll("file"); // Support multiple file= params, or split by comma?
                        // Let's assume the frontend might send multiple `file` params or we can parse a single one if comma separated.
                        // Standard URLSearchParams handles multiple keys well.

                        const results = await gitService.search(targetProject, targetRepo, query, {
                            isRegex,
                            contextLines,
                            filePatterns: filePatterns.length ? filePatterns : undefined,
                            isPathSearch: searchType === "path"
                        });
                        return Response.json(results);
                    }
                }

                return Response.json([]);
            } catch (error: any) {
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
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
                // Try to resolve project info first to check local clone
                const repoInfo = await azureClient.getRepositoryById(repoId);

                if (repoInfo && repoInfo.project && repoInfo.name) {
                    if (await gitService.isCloned(repoInfo.project.name, repoInfo.name)) {

                        const items = await gitService.listFiles(repoInfo.project.name, repoInfo.name, path);
                        return Response.json(items);
                    }
                }

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
                // Try to resolve project info first to check local clone
                const repoInfo = await azureClient.getRepositoryById(repoId);

                if (repoInfo && repoInfo.project && repoInfo.name) {
                    if (await gitService.isCloned(repoInfo.project.name, repoInfo.name)) {
                        const content = await gitService.getFileContent(repoInfo.project.name, repoInfo.name, path, version || undefined);
                        return Response.json({ content });
                    }
                }

                const content = await azureClient.getFileContent(repoId, path, version || undefined, versionType);
                return Response.json({ content });
            } catch (error: any) {
                console.error("Error fetching repo content:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
};
