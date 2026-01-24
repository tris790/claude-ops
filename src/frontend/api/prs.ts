export async function getPullRequests(status: string = "active") {
    const res = await fetch(`/api/prs?status=${status}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch pull requests");
    }
    return res.json();
}

export async function getPullRequest(id: string) {
    const res = await fetch(`/api/prs/${id}`);
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
