export async function getPipelines() {
    const res = await fetch("/api/pipelines");
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch pipelines");
    }
    return res.json();
}

export async function getPipeline(pipelineId: number) {
    const res = await fetch(`/api/pipelines/${pipelineId}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch pipeline");
    }
    return res.json();
}

export async function getPipelineRuns(pipelineId: number) {
    const res = await fetch(`/api/pipelines/${pipelineId}/runs`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch pipeline runs");
    }
    return res.json();
}

export async function getRecentRuns() {
    const res = await fetch("/api/pipelines/runs");
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch pipeline runs");
    }
    return res.json();
}

export async function runPipeline(pipelineId: number, branch: string) {
    const res = await fetch("/api/pipelines/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, branch }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to run pipeline");
    }
    return res.json();
}

export async function cancelRun(runId: number) {
    const res = await fetch(`/api/pipelines/runs/${runId}/cancel`, {
        method: "POST"
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel run");
    }
    return res.json();
}

export async function getRun(runId: number) {
    const res = await fetch(`/api/pipelines/runs/${runId}`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch run details");
    }
    return res.json();
}

export async function getRunTimeline(runId: number) {
    const res = await fetch(`/api/pipelines/runs/${runId}/timeline`);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch timeline");
    }
    return res.json();
}

export async function getLogContent(runId: number, logId: number) {
    const res = await fetch(`/api/pipelines/runs/${runId}/logs/${logId}`);
    if (!res.ok) {
        try {
            const error = await res.json();
            throw new Error(error.error || "Failed to fetch logs");
        } catch {
            throw new Error("Failed to fetch logs");
        }
    }
    return res.text();
}
