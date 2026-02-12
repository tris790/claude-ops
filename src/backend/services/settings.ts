import { join } from "path";
import { file, write } from "bun";
import { type Settings } from "../../shared/types";

const CONFIG_PATH = join(process.cwd(), "config.json");

export const extractPlaceholders = (prompt: string): string[] => {
    const matches = prompt.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map(m => m.slice(2, -2))));
};

export const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    repoCloneDirectory: join(process.cwd(), ".repos"),
    lsp: {
        requestTimeoutMs: 6000,
        maxQueueBytes: 1024 * 1024,
        instanceInitTimeoutMs: 15000,
        circuitBreaker: {
            enabled: true
        }
    },
    aiCommandPrompts: {
        'generate_pr_description': {
            prompt: 'claude "Write a PR description for changes between {{target_branch}} and {{source_branch}}."',
            placeholders: ['target_branch', 'source_branch']
        },
        'apply_fix': {
            prompt: 'claude "Apply the following change to file {{file_path}} on branch {{branch}}: \'{{comment}}\'. Code context: {{code_context}}"',
            placeholders: ['file_path', 'branch', 'comment', 'code_context']
        },
        'implement_work_item': {
            prompt: 'claude "You are an autonomous developer agent. Your task is to implement Work Item #{{id}}: {{title}}.\nRepositories: {{repos}}\nContext: {{organization}}/{{project}}\nDescription: {{description}}.\n\nPlan:\n1. Explore codebase and create implementation plan.\n2. Create tasks/sub-agents for the implementation steps.\n3. Create branch \'feat/wi-{{id}}\' in relevant repositories.\n4. Implement changes and tests.\n5. Create Draft PR.\n\nExecute this plan autonomously, coordinating the creation of tasks as needed."',
            placeholders: ['id', 'title', 'repos', 'organization', 'project', 'description']
        }
    }
};

export async function getSettings(): Promise<Settings> {
    const configFile = file(CONFIG_PATH);
    if (await configFile.exists()) {
        try {
            const text = await configFile.text();
            const json = JSON.parse(text);
            const merged = { ...DEFAULT_SETTINGS, ...json };

            // Start of migration logic (Handle old array format if present in JSON)
            if (Array.isArray(json.aiCommandPrompts)) {
                const newPrompts: Record<string, { prompt: string; placeholders: string[] }> = { ...DEFAULT_SETTINGS.aiCommandPrompts };
                for (const p of json.aiCommandPrompts) {
                    if (p.name && p.prompt) {
                        newPrompts[p.name] = {
                            prompt: p.prompt,
                            placeholders: extractPlaceholders(p.prompt)
                        };
                    }
                }
                merged.aiCommandPrompts = newPrompts;
            } else {
                // Ensure all default prompts exist even if not in JSON
                merged.aiCommandPrompts = {
                    ...DEFAULT_SETTINGS.aiCommandPrompts,
                    ...json.aiCommandPrompts
                };
            }

            merged.lsp = {
                ...DEFAULT_SETTINGS.lsp,
                ...json.lsp,
                circuitBreaker: {
                    ...DEFAULT_SETTINGS.lsp.circuitBreaker,
                    ...json.lsp?.circuitBreaker
                }
            };

            // Ensure all prompts have placeholders
            if (merged.aiCommandPrompts) {
                for (const key in merged.aiCommandPrompts) {
                    if (!merged.aiCommandPrompts[key].placeholders) {
                        merged.aiCommandPrompts[key].placeholders = extractPlaceholders(merged.aiCommandPrompts[key].prompt);
                    }
                }
            }

            return merged;
        } catch (e) {
            console.error("Failed to parse config.json", e);
            return DEFAULT_SETTINGS;
        }
    }
    return DEFAULT_SETTINGS;
}



export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const current = await getSettings();
    const newSettings = { ...current, ...updates };

    await write(CONFIG_PATH, JSON.stringify(newSettings, null, 2));

    return newSettings;
}
