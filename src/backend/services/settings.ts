import { join } from "path";
import { file, write } from "bun";
import { type Settings } from "../../shared/types";

const CONFIG_PATH = join(process.cwd(), "config.json");

export const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    repoCloneDirectory: join(process.cwd(), ".repos"),
    aiCommandPrompts: [
        {
            id: 'generate_pr_description',
            name: 'generate_pr_description',
            prompt: 'claude "Write a PR description for changes between {{target_branch}} and {{source_branch}}."'
        },
        {
            id: 'apply_fix',
            name: 'apply_fix',
            prompt: 'claude "Apply the following change to file {{file_path}} on branch {{branch}}: \'{{comment}}\'. Code context: {{code_context}}"'
        }
    ]
};

export async function getSettings(): Promise<Settings> {
    const configFile = file(CONFIG_PATH);
    if (await configFile.exists()) {
        try {
            const text = await configFile.text();
            const json = JSON.parse(text);
            const merged = { ...DEFAULT_SETTINGS, ...json };

            // If prompts are empty (likely from old config), populate with defaults
            if (!merged.aiCommandPrompts || merged.aiCommandPrompts.length === 0) {
                merged.aiCommandPrompts = DEFAULT_SETTINGS.aiCommandPrompts;
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
