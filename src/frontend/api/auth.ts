export async function getAuthStatus() {
    const res = await fetch("/api/auth/status");
    if (!res.ok) {
        throw new Error("Failed to check auth status");
    }
    return res.json();
}

export async function getCurrentUser() {
    const res = await fetch("/api/user");
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch current user");
    }
    return res.json();
}

export async function setupConnection(orgUrl: string, pat: string) {
    const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUrl, pat }),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Setup failed");
    }

    return res.json();
}
