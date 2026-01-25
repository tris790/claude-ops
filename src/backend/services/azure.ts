export class AzureDevOpsClient {
    private get headers() {
        const pat = process.env.AZURE_DEVOPS_PAT;
        // Basic auth requires empty username and PAT as password
        const b64 = Buffer.from(`:${pat}`).toString("base64");
        return {
            "Authorization": `Basic ${b64}`,
            "Content-Type": "application/json"
        };
    }

    private normalizeUrl(url?: string) {
        if (!url) return undefined;
        try {
            const u = new URL(url);
            // Handle visualstudio.com -> strip path (e.g. /ProjectName)
            if (u.hostname.endsWith(".visualstudio.com")) {
                return u.origin;
            }
            // Handle dev.azure.com -> keep organization only (first path segment)
            if (u.hostname === "dev.azure.com") {
                const parts = u.pathname.split("/").filter(Boolean);
                if (parts.length > 0) {
                    return `${u.origin}/${parts[0]}`;
                }
            }
        } catch {
            // Invalid URL or other cases, fallback to simple trim
        }
        return url.replace(/\/$/, "");
    }

    private get baseUrl() {
        return this.normalizeUrl(process.env.AZURE_DEVOPS_ORG_URL);
    }

    async validateConnection(orgUrl?: string, pat?: string) {
        // Allow passing credentials explicitly for setup/validation
        const rawUrl = orgUrl || process.env.AZURE_DEVOPS_ORG_URL;
        const targetUrl = this.normalizeUrl(rawUrl);
        const targetPat = pat || process.env.AZURE_DEVOPS_PAT;

        if (!targetUrl || !targetPat) {
            throw new Error("Missing configuration");
        }

        const b64 = Buffer.from(`:${targetPat}`).toString("base64");
        const headers = {
            "Authorization": `Basic ${b64}`,
            "Content-Type": "application/json"
        };

        const url = `${targetUrl}/_apis/projects?api-version=7.0`;
        try {
            const res = await fetch(url, { headers });

            if (!res.ok) {
                if (res.status === 401) throw new Error("Invalid Personal Access Token");
                if (res.status === 404) throw new Error("Organization not found");
                throw new Error(`Connection failed: ${res.status} ${res.statusText}`);
            }

            return await res.json();
        } catch (error: any) {
            throw new Error(error.message || "Failed to connect to Azure DevOps");
        }
    }

    async getCurrentUser() {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/connectionData?api-version=7.0-preview`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch user info: ${res.status} ${res.statusText} - ${text}`);
        }

        const data = await res.json();
        return data.authenticatedUser;
    }

    private projectCache: { data: any[], timestamp: number } | null = null;

    async getProjects() {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        if (this.projectCache && (Date.now() - this.projectCache.timestamp < this.CACHE_TTL)) {
            return this.projectCache.data;
        }

        const url = `${this.baseUrl}/_apis/projects?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const projects = data.value || [];

        this.projectCache = {
            data: projects,
            timestamp: Date.now()
        };

        return projects;
    }
    private repoCache: { data: any[], timestamp: number } | null = null;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    async getRepositories() {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        if (this.repoCache && (Date.now() - this.repoCache.timestamp < this.CACHE_TTL)) {
            return this.repoCache.data;
        }

        const url = `${this.baseUrl}/_apis/git/repositories?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch repositories: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const value = data.value || [];

        this.repoCache = {
            data: value,
            timestamp: Date.now()
        };

        return value;
    }

    async getRepositoryById(repoId: string) {
        const repos = await this.getRepositories();
        return repos.find((r: any) => r.id === repoId);
    }

    async getBranches(repoId: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/git/repositories/${repoId}/refs?filter=heads/&api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch branches: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return (data.value || []).map((ref: any) => ({
            name: ref.name.replace("refs/heads/", ""),
            objectId: ref.objectId
        }));
    }

    async getRepoItems(repoId: string, path: string = "/", version?: string, versionType: string = "branch") {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const scopePath = path;

        const url = new URL(`${this.baseUrl}/_apis/git/repositories/${repoId}/items`);
        url.searchParams.append("scopePath", scopePath);
        url.searchParams.append("recursionLevel", "OneLevel");
        if (version) {
            url.searchParams.append("versionDescriptor.version", version);
            url.searchParams.append("versionDescriptor.versionType", versionType);
        }
        url.searchParams.append("api-version", "7.0");

        const res = await fetch(url.toString(), { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch items: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data.value || [];
    }

    async getFileContent(repoId: string, path: string, version?: string, versionType: string = "branch") {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = new URL(`${this.baseUrl}/_apis/git/repositories/${repoId}/items`);
        url.searchParams.append("path", path);
        url.searchParams.append("$format", "text"); // More reliable way to get raw content
        if (version) {
            url.searchParams.append("versionDescriptor.version", version);
            url.searchParams.append("versionDescriptor.versionType", versionType);
        }
        url.searchParams.append("api-version", "7.0");

        const res = await fetch(url.toString(), {
            headers: {
                ...this.headers,
                "Accept": "text/plain, */*"
            }
        });

        if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            console.error(`Azure API Error (${res.status}): ${errorText}`);
            throw new Error(`Failed to fetch file content: ${res.status} ${res.statusText}`);
        }

        return await res.text();
    }

    async getPullRequestChanges(repoId: string, id: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        // 1. Resolve PR context safely
        const pr = await this.getPullRequest(id, repoId);
        // pr.url is the safe base for this PR (e.g. includes Project GUID)
        // e.g. .../pullRequests/1

        // 2. Try fetching changes through iterations (most reliable for diffs)
        try {
            const iterationsUrl = `${pr.url}/iterations?api-version=7.0`;
            const iterationsRes = await fetch(iterationsUrl, { headers: this.headers });
            if (iterationsRes.ok) {
                const iterationsData = await iterationsRes.json();
                const iterations = iterationsData.value || [];
                if (iterations.length > 0) {
                    const lastIteration = iterations[iterations.length - 1];
                    const changesUrl = lastIteration.url
                        ? `${lastIteration.url}/changes?api-version=7.0`
                        : `${pr.url}/iterations/${lastIteration.id}/changes?api-version=7.0`;

                    const changesRes = await fetch(changesUrl, { headers: this.headers });
                    if (changesRes.ok) {
                        const data = await changesRes.json();
                        // Normalize changeEntries to changes if needed (iteration changes endpoint uses changeEntries)
                        if (data.changeEntries && !data.changes) {
                            data.changes = data.changeEntries;
                        }
                        return data;
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to fetch changes via iterations, falling back to direct...", e);
        }

        // Fallback: Try direct changes endpoint relative to the PR's valid internal URL
        // pr.url is .../_apis/git/repositories/{guid}/pullRequests/{id}
        const url = `${pr.url}/changes?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            // If even that fails, try legacy construction but use the safe project from PR if available
            throw new Error(`Failed to fetch PR changes: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async getPullRequestCommits(repoId: string, id: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        // 1. Resolve PR context safely
        const pr = await this.getPullRequest(id, repoId);

        // 2. Use safe URL
        const url = `${pr.url}/commits?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch PR commits: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data.value || [];
    }

    async queryWorkItems(wiql: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/wit/wiql?api-version=7.0`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ query: wiql })
        });

        if (!res.ok) {
            throw new Error(`Failed to query work items: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async getWorkItems(ids: number[]) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        if (ids.length === 0) return [];

        const url = new URL(`${this.baseUrl}/_apis/wit/workitems`);
        url.searchParams.append("ids", ids.join(","));
        url.searchParams.append("$expand", "relations");
        url.searchParams.append("api-version", "7.0");

        const res = await fetch(url.toString(), { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch work items details: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data.value || [];
    }

    async updateWorkItem(id: number, updates: any[]) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/wit/workitems/${id}?api-version=7.0`;
        const res = await fetch(url, {
            method: "PATCH",
            headers: {
                ...this.headers,
                "Content-Type": "application/json-patch+json"
            },
            body: JSON.stringify(updates)
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || `Failed to update work item: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async addWorkItemComment(id: number, text: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/wit/workitems/${id}/comments?api-version=7.0`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ text })
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || `Failed to add comment: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async getPullRequests(criteria?: any) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        // Helper to fetch PRs for a specific project
        const fetchForProject = async (projectName: string) => {
            const url = new URL(`${this.baseUrl}/${projectName}/_apis/git/pullrequests`);
            url.searchParams.append("api-version", "7.0");

            if (criteria?.status) url.searchParams.append("searchCriteria.status", criteria.status);
            if (criteria?.reviewerId) url.searchParams.append("searchCriteria.reviewerId", criteria.reviewerId);
            if (criteria?.creatorId) url.searchParams.append("searchCriteria.creatorId", criteria.creatorId);
            if (criteria?.repositoryId) url.searchParams.append("searchCriteria.repositoryId", criteria.repositoryId);

            const res = await fetch(url.toString(), { headers: this.headers });
            if (!res.ok) {
                console.warn(`Failed to fetch PRs for project ${projectName}: ${res.status}`);
                return [];
            }
            const data = await res.json();
            return data.value || [];
        };

        // If project is specified, simple fetch
        if (criteria?.project) {
            return await fetchForProject(criteria.project);
        }

        // Otherwise, we must fetch for ALL projects (Organization view)
        // Otherwise, we must fetch for ALL projects (Organization view)
        let projects = [];
        try {
            // 1. Get all projects
            projects = await this.getProjects();
        } catch (error: any) {
            console.warn(`[Azure] Failed to list projects (${error.message}). Attempting direct fetch from Base URL...`);

            // Fallback: Try fetching for the current context (implied project)
            const url = new URL(`${this.baseUrl}/_apis/git/pullrequests`);
            url.searchParams.append("api-version", "7.0");

            if (criteria?.status) url.searchParams.append("searchCriteria.status", criteria.status);
            if (criteria?.reviewerId) url.searchParams.append("searchCriteria.reviewerId", criteria.reviewerId);
            if (criteria?.creatorId) url.searchParams.append("searchCriteria.creatorId", criteria.creatorId);
            if (criteria?.repositoryId) url.searchParams.append("searchCriteria.repositoryId", criteria.repositoryId);

            const res = await fetch(url.toString(), { headers: this.headers });
            if (!res.ok) {
                throw error; // Rethrow original error if fallback fails
            }
            const data = await res.json();
            return data.value || [];
        }

        // 2. Fetch PRs for each project in parallel
        const results = await Promise.all(
            projects.map((p: any) => fetchForProject(p.name))
        );

        // 3. Flatten results
        return results.flat().sort((a: any, b: any) =>
            new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
        );
    }

    async getPullRequest(id: string, repoId?: string, project?: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        let url: string;

        // Best case: We have repoId (and implicitly project context from repo)
        if (repoId && project) {
            url = `${this.baseUrl}/${project}/_apis/git/repositories/${repoId}/pullRequests/${id}?api-version=7.0`;
        }
        // fallback: We have project, can use project-scoped search
        else if (project) {
            url = `${this.baseUrl}/${project}/_apis/git/pullrequests/${id}?api-version=7.0`;
        }
        // fallback 2: We have repoId but no project (rare, implies inferred project probably won't work perfectly without project in path)
        else if (repoId) {
            // Try to infer standard structure or user legacy collection support
            url = `${this.baseUrl}/_apis/git/repositories/${repoId}/pullRequests/${id}?api-version=7.0`;
        }
        // Worst case: Just ID. We need to find the project.
        else {
            // We can't fetch a PR by ID globally without a project. 
            // We will try to iterate active projects to find it. This is expensive.
            console.log(`[Azure] Searching for PR ${id} across all projects (missing context)...`);
            try {
                const projects = await this.getProjects();
                for (const p of projects) {
                    try {
                        const tryUrl = `${this.baseUrl}/${p.name}/_apis/git/pullrequests/${id}?api-version=7.0`;
                        const res = await fetch(tryUrl, { headers: this.headers });
                        if (res.ok) {
                            return await res.json();
                        }
                    } catch { /* continue */ }
                }
            } catch (error: any) {
                console.warn(`[Azure] Failed to list projects (${error.message}). Attempting direct fetch from Base URL...`);
                // Fallback: Try fetching assuming Base URL is project-scoped
                const url = `${this.baseUrl}/_apis/git/pullrequests/${id}?api-version=7.0`;
                const res = await fetch(url, { headers: this.headers });
                if (res.ok) {
                    return await res.json();
                }
            }
            throw new Error(`Pull Request ${id} not found in any project`);
        }

        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            // Special handling: If 404/400 and we guessed, throw specific error
            const text = await res.text();
            throw new Error(`Failed to fetch pull request: ${res.status} ${text}`);
        }

        return await res.json();
    }

    async getPullRequestThreads(repoId: string, id: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const pr = await this.getPullRequest(id, repoId);

        const url = `${pr.url}/threads?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch PR threads: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data.value || [];
    }

    async createPullRequestThread(repoId: string, id: string, content: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const pr = await this.getPullRequest(id, repoId);

        const url = `${pr.url}/threads?api-version=7.0`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
                comments: [
                    {
                        parentCommentId: 0,
                        content: content,
                        commentType: 1 // Text
                    }
                ],
                status: 1 // Active
            })
        });

        if (!res.ok) {
            throw new Error(`Failed to create thread: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }


    async votePullRequest(repoId: string, id: string, reviewerId: string, vote: number) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/git/repositories/${repoId}/pullRequests/${id}/reviewers/${reviewerId}?api-version=7.0`;
        const res = await fetch(url, {
            method: "PUT",
            headers: this.headers,
            body: JSON.stringify({ vote })
        });

        if (!res.ok) {
            throw new Error(`Failed to vote on PR: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async updatePullRequest(repoId: string, id: string, data: any) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/git/repositories/${repoId}/pullRequests/${id}?api-version=7.0`;
        const res = await fetch(url, {
            method: "PATCH",
            headers: this.headers,
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || `Failed to update PR: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async getPipelines() {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/pipelines?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch pipelines: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data.value || [];
    }

    async getRecentRuns() {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        // Using builds API for better run history
        const url = `${this.baseUrl}/_apis/build/builds?api-version=7.0&maxBuildsPerDefinition=1`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch recent runs: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data.value || [];
    }

    async runPipeline(pipelineId: number, branch: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/pipelines/${pipelineId}/runs?api-version=7.0`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
                resources: {
                    repositories: {
                        self: {
                            refName: branch.startsWith("refs/") ? branch : `refs/heads/${branch}`
                        }
                    }
                }
            })
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || `Failed to run pipeline: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async cancelRun(buildId: number) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/build/builds/${buildId}?api-version=7.0`;
        const res = await fetch(url, {
            method: "PATCH",
            headers: this.headers,
            body: JSON.stringify({ status: "Cancelling" })
        });

        if (!res.ok) {
            throw new Error(`Failed to cancel run: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async getRunTimeline(buildId: number) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/build/builds/${buildId}/timeline?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch timeline: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async getLogContent(buildId: number, logId: number) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/build/builds/${buildId}/logs/${logId}?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch log: ${res.status} ${res.statusText}`);
        }

        return await res.text();
    }
}

export const azureClient = new AzureDevOpsClient();
