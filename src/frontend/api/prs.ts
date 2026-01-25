export async function getPullRequests(status: string = "active") {
    const res = await fetch(`/api/prs?status=${status}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch pull requests");
    }
    return res.json();
}

export async function getPullRequest(id: string, repoId?: string) {
    const url = repoId ? `/api/prs/${id}?repoId=${repoId}` : `/api/prs/${id}`;
    const res = await fetch(url);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch pull request");
    }
    return res.json();
}

export async function getPullRequestThreads(id: string, repoId: string) {
    const res = await fetch(`/api/prs/${id}/threads?repoId=${repoId}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch PR threads");
    }
    return res.json();
}

export async function createPullRequestThread(id: string, repoId: string, content: string, threadContext?: any) {
    const res = await fetch(`/api/prs/${id}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, content, threadContext }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create thread");
    }
    return res.json();
}

export async function votePullRequest(id: string, repoId: string, reviewerId: string, vote: number) {
    const res = await fetch(`/api/prs/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, reviewerId, vote }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to vote on PR");
    }
    return res.json();
}

export async function getPullRequestChanges(id: string, repoId: string) {
    const res = await fetch(`/api/prs/${id}/changes?repoId=${repoId}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch PR changes");
    }
    return res.json();
}

export async function getPullRequestCommits(id: string, repoId: string) {
    const res = await fetch(`/api/prs/${id}/commits?repoId=${repoId}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch PR commits");
    }

    return res.json();
}

export async function updatePullRequest(id: string, repoId: string, data: any) {
    const res = await fetch(`/api/prs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, ...data }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update PR");
    }
    return res.json();
}
