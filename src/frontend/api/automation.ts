
export async function runAutomation(task: string, context: Record<string, any>) {
    const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ task, context })
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || error.error || `Automation task failed: ${res.status}`);
    }

    return await res.json();
}
