import { join } from "path";
import { file, write } from "bun";

const ENV_PATH = join(process.cwd(), ".env");

export async function readEnvFile() {
    const envFile = file(ENV_PATH);
    if (await envFile.exists()) {
        const text = await envFile.text();
        return parseEnv(text);
    }
    return {};
}

export async function updateEnv(updates: Record<string, string>) {
    const current = await readEnvFile();
    const merged = { ...current, ...updates };

    // Update process.env for runtime usage
    Object.entries(updates).forEach(([key, value]) => {
        process.env[key] = value;
    });

    const content = Object.entries(merged)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");

    await write(ENV_PATH, content);
}

function parseEnv(text: string) {
    const res: Record<string, string> = {};
    text.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const [key, ...rest] = trimmed.split("=");
        if (key && rest.length > 0) {
            res[key.trim()] = rest.join("=").trim();
        }
    });
    return res;
}
