export interface Settings {
    theme: 'dark' | 'light';
    repoCloneDirectory: string;
    aiCommandPrompts: {
        id: string;
        name: string;
        prompt: string;
    }[];
}

export interface EnvConfig {
    AZURE_DEVOPS_ORG_URL?: string;
    AZURE_DEVOPS_PAT?: string;
}
