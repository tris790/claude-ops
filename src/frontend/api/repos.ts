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

export async function getRepositories(): Promise<GitRepository[]> {
    const res = await fetch("/api/repos");
    if (!res.ok) {
        throw new Error(`Failed to fetch repositories: ${res.statusText}`);
    }
    return res.json();
}
