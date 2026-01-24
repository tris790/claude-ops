export interface GitRepository {
    id: string;
    name: string;
    url: string;
    isCloned?: boolean;
    defaultBranch?: string;
    project: {
        id: string;
        name: string;
        description?: string;
    };
    webUrl: string;
}

export interface GitItem {
    objectId: string;
    gitObjectType: "blob" | "tree";
    commitId: string;
    path: string;
    url: string;
}

export async function getRepositories(): Promise<GitRepository[]> {
    const res = await fetch("/api/repos");
    if (!res.ok) {
        throw new Error(`Failed to fetch repositories: ${res.statusText}`);
    }
    return res.json();
}

export async function getRepoItems(repoId: string, path: string = "/", version?: string): Promise<GitItem[]> {
    const params = new URLSearchParams({ repoId, path });
    if (version) params.append("version", version);
    const res = await fetch(`/api/repo-items?${params}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch repo items: ${res.statusText}`);
    }
    return res.json();
}

export async function getBranches(repoId: string): Promise<{ name: string; objectId: string }[]> {
    const res = await fetch(`/api/repos/branches?repoId=${repoId}`);
    if (!res.ok) throw new Error("Failed to fetch branches");
    return res.json();
}

export async function getFileContent(repoId: string, path: string, version?: string, versionType: string = "branch"): Promise<string> {
    const params = new URLSearchParams({ repoId, path });
    if (version) {
        params.append("version", version);
        params.append("versionType", versionType);
    }
    const res = await fetch(`/api/repo-content?${params}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch file content: ${res.statusText}`);
    }
    const data = await res.json();
    return data.content;
}

export async function cloneRepository(projectName: string, repoName: string, remoteUrl: string): Promise<void> {
    const res = await fetch("/api/repos/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, repoName, remoteUrl }),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to clone repository: ${res.statusText}`);
    }
}

export async function syncRepository(projectName: string, repoName: string): Promise<void> {
    const res = await fetch("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, repoName }),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to sync repository: ${res.statusText}`);
    }
}
