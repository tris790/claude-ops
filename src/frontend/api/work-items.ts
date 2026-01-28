export async function getMyWorkItems() {
    const res = await fetch("/api/work-items?filter=my");
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch work items");
    }
    return res.json();
}

export async function getRecentWorkItems() {
    const res = await fetch("/api/work-items?filter=recent");
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch work items");
    }
    return res.json();
}

export async function queryWorkItems(wiql: string) {
    const res = await fetch(`/api/work-items?query=${encodeURIComponent(wiql)}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to query work items");
    }
    return res.json();
}

export async function getWorkItemDetails(id: number) {
    const res = await fetch(`/api/work-items/details?id=${id}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch work item details");
    }
    return res.json();
}

export async function updateWorkItem(id: number, fields: Record<string, any>) {
    const res = await fetch(`/api/work-items/details?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update work item");
    }
    return res.json();
}

export async function addWorkItemComment(id: number, text: string) {
    const res = await fetch(`/api/work-items/comments?id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add comment");
    }
    return res.json();
}
