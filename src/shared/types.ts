export interface LspSettings {
    requestTimeoutMs: number;
    maxQueueBytes: number;
    instanceInitTimeoutMs: number;
    circuitBreaker: {
        enabled: boolean;
    };
}

export interface Settings {
    theme: 'dark' | 'light';
    repoCloneDirectory: string;
    aiCommandPrompts: Record<string, {
        prompt: string;
        placeholders: string[];
    }>;
    lsp: LspSettings;
}

export interface EnvConfig {
    AZURE_DEVOPS_ORG_URL?: string;
    AZURE_DEVOPS_PAT?: string;
}
