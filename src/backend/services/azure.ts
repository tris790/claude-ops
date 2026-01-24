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

    private get baseUrl() {
        // e.g. https://dev.azure.com/myorg
        return process.env.AZURE_DEVOPS_ORG_URL?.replace(/\/$/, "");
    }

    async validateConnection(orgUrl?: string, pat?: string) {
        // Allow passing credentials explicitly for setup/validation
        const targetUrl = (orgUrl || this.baseUrl)?.replace(/\/$/, "");
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

    async getRepoItems(repoId: string, path: string = "/") {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const scopePath = path;

        const url = new URL(`${this.baseUrl}/_apis/git/repositories/${repoId}/items`);
        url.searchParams.append("scopePath", scopePath);
        url.searchParams.append("recursionLevel", "OneLevel");
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

        const url = `${this.baseUrl}/_apis/git/repositories/${repoId}/pullRequests/${id}/changes?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch PR changes: ${res.status} ${res.statusText}`);
        }

        return await res.json();
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

        const url = new URL(`${this.baseUrl}/_apis/git/pullrequests`);
        url.searchParams.append("api-version", "7.0");
        if (criteria?.status) url.searchParams.append("searchCriteria.status", criteria.status);
        if (criteria?.reviewerId) url.searchParams.append("searchCriteria.reviewerId", criteria.reviewerId);
        if (criteria?.creatorId) url.searchParams.append("searchCriteria.creatorId", criteria.creatorId);

        const res = await fetch(url.toString(), { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch pull requests: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data.value || [];
    }

    async getPullRequest(id: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/git/pullrequests/${id}?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch pull request: ${res.status} ${res.statusText}`);
        }

        return await res.json();
    }

    async getPullRequestThreads(repoId: string, id: string) {
        if (!this.baseUrl || !process.env.AZURE_DEVOPS_PAT) {
            throw new Error("Missing configuration");
        }

        const url = `${this.baseUrl}/_apis/git/repositories/${repoId}/pullRequests/${id}/threads?api-version=7.0`;
        const res = await fetch(url, { headers: this.headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch PR threads: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data.value || [];
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
