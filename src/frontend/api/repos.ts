export interface GitRepository {
    id: string;
    name: string;
    url: string;
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

export async function getRepoItems(repoId: string, path: string = "/"): Promise<GitItem[]> {
    const params = new URLSearchParams({ repoId, path });
    const res = await fetch(`/api/repo-items?${params}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch repo items: ${res.statusText}`);
    }
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
