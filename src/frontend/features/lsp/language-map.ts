export type LspClientLanguage =
    | "typescript"
    | "typescriptreact"
    | "go"
    | "python"
    | "c"
    | "cpp"
    | "csharp";

const EXTENSION_LANGUAGE_MAP: Record<string, LspClientLanguage> = {
    ts: "typescript",
    js: "typescript",
    tsx: "typescriptreact",
    jsx: "typescriptreact",
    go: "go",
    py: "python",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cc: "cpp",
    cs: "csharp",
};

export function getLspLanguageFromPath(path: string): LspClientLanguage | null {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return EXTENSION_LANGUAGE_MAP[ext] || null;
}
