export interface LspStatusResponse {
    requestedLanguage: string;
    normalizedLanguage: string | null;
    supported: boolean;
    installed: boolean;
    resolverTier: "project" | "system" | "vscode" | null;
    command: string[] | null;
    canInstall: boolean;
    missingReason: string | null;
    installUnavailableReason?: string | null;
}

export interface LspInstallRequestResult {
    jobId: string;
    status: "pending" | "running" | "completed" | "failed";
    queuedLanguages: string[];
}

export interface LspInstallStep {
    language: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    message: string;
    command: string | null;
    output: string[];
    startedAt: number | null;
    completedAt: number | null;
}

export interface LspInstallJob {
    id: string;
    projectName: string;
    repoName: string;
    rootPath: string;
    status: "pending" | "running" | "completed" | "failed";
    error: string | null;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    steps: LspInstallStep[];
}

export async function getLspStatus(projectName: string, repoName: string, language: string): Promise<LspStatusResponse> {
    const params = new URLSearchParams({
        project: projectName,
        repo: repoName,
        language,
    });

    const res = await fetch(`/api/lsp/status?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch LSP status: ${res.statusText}`);
    }

    return res.json();
}

export async function startLspInstall(projectName: string, repoName: string, languages: string[]): Promise<LspInstallRequestResult> {
    const res = await fetch("/api/lsp/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, repoName, languages }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || data?.details?.join?.("; ") || `Failed to start LSP install: ${res.statusText}`);
    }

    return res.json();
}

export async function getLspInstallJob(jobId: string): Promise<LspInstallJob> {
    const res = await fetch(`/api/lsp/install/${encodeURIComponent(jobId)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch LSP install job: ${res.statusText}`);
    }

    return res.json();
}
