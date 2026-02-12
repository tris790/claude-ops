import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "path";

export type RequestedLspLanguage =
    | "typescript"
    | "typescriptreact"
    | "javascript"
    | "javascriptreact"
    | "go"
    | "python"
    | "c"
    | "cpp"
    | "csharp";

export type NormalizedLspLanguage =
    | "typescript"
    | "javascript"
    | "go"
    | "python"
    | "c"
    | "cpp"
    | "csharp";

export type LspResolverTier = "project" | "system" | "vscode";

export interface ResolvedLspCommand {
    command: string[];
    tier: LspResolverTier;
}

const SUPPORTED_INPUT_LANGUAGES = new Set<string>([
    "typescript",
    "typescriptreact",
    "javascript",
    "javascriptreact",
    "go",
    "python",
    "c",
    "cpp",
    "csharp",
]);

const CLANGD_ARGS = [
    "--background-index",
    "--clang-tidy",
    "--completion-style=detailed",
    "--header-insertion=iwyu",
    "-j=4",
];

const fileExists = async (path: string) => {
    try {
        return await Bun.file(path).exists();
    } catch {
        return false;
    }
};

export function normalizeLspLanguage(language: string): NormalizedLspLanguage | null {
    if (language === "typescriptreact") return "typescript";
    if (language === "javascriptreact") return "javascript";
    if (language === "typescript") return "typescript";
    if (language === "javascript") return "javascript";
    if (language === "go") return "go";
    if (language === "python") return "python";
    if (language === "c") return "c";
    if (language === "cpp") return "cpp";
    if (language === "csharp") return "csharp";
    return null;
}

export function isSupportedLspLanguage(language: string) {
    return SUPPORTED_INPUT_LANGUAGES.has(language);
}

const findExtensionBin = async (publisherAndName: string, binPaths: string[]) => {
    const home = homedir();
    if (!home) return null;

    const extensionsDir = join(home, ".vscode/extensions");
    try {
        const entries = await readdir(extensionsDir);
        const matches = entries
            .filter((entry) => entry.startsWith(publisherAndName))
            .sort()
            .reverse();

        for (const match of matches) {
            for (const binPath of binPaths) {
                const fullPath = join(extensionsDir, match, binPath);
                if (await fileExists(fullPath)) return fullPath;
            }
        }
    } catch {
    }

    return null;
};

const resolveTypeScriptCommand = async (rootPath: string): Promise<ResolvedLspCommand | null> => {
    const projectCandidates = [
        resolve(rootPath, "node_modules/typescript-language-server/lib/cli.js"),
        resolve(rootPath, "node_modules/typescript-language-server/lib/cli.mjs"),
        resolve(rootPath, "node_modules/.bin/typescript-language-server"),
    ];

    for (const candidate of projectCandidates) {
        if (await fileExists(candidate)) {
            return { command: ["node", candidate, "--stdio"], tier: "project" };
        }
    }

    const appCandidates = [
        resolve(process.cwd(), "node_modules/typescript-language-server/lib/cli.js"),
        resolve(process.cwd(), "node_modules/typescript-language-server/lib/cli.mjs"),
        resolve(process.cwd(), "node_modules/.bin/typescript-language-server"),
    ];

    for (const candidate of appCandidates) {
        if (await fileExists(candidate)) {
            return { command: ["node", candidate, "--stdio"], tier: "system" };
        }
    }

    const bin = Bun.which("typescript-language-server");
    if (bin) {
        return { command: [bin, "--stdio"], tier: "system" };
    }

    return null;
};

const resolveGoCommand = async (): Promise<ResolvedLspCommand | null> => {
    const bin = Bun.which("gopls");
    if (bin) return { command: [bin], tier: "system" };

    const extBin = await findExtensionBin("golang.go", ["bin/gopls", "bin/gopls.exe"]);
    if (extBin) return { command: [extBin], tier: "vscode" };

    return null;
};

const resolveCOrCppCommand = async (): Promise<ResolvedLspCommand | null> => {
    const bin = Bun.which("clangd");
    if (bin) return { command: [bin, ...CLANGD_ARGS], tier: "system" };

    const knownPaths = [
        "/usr/bin/clangd",
        "/opt/homebrew/opt/llvm/bin/clangd",
        "/usr/local/opt/llvm/bin/clangd",
        "C:/Program Files/LLVM/bin/clangd.exe",
    ];

    for (const candidate of knownPaths) {
        if (await fileExists(candidate)) {
            return { command: [candidate, ...CLANGD_ARGS], tier: "system" };
        }
    }

    return null;
};

const resolveCSharpCommand = async (): Promise<ResolvedLspCommand | null> => {
    const home = homedir();
    if (home) {
        const dotnetGlobalToolCandidates = [
            join(home, ".dotnet/tools/csharp-ls"),
            join(home, ".dotnet/tools/csharp-ls.exe"),
        ];

        for (const candidate of dotnetGlobalToolCandidates) {
            if (await fileExists(candidate)) {
                return { command: [candidate], tier: "system" };
            }
        }

        const extensionsDir = join(home, ".vscode/extensions");
        try {
            const entries = await readdir(extensionsDir);
            const csharpExts = entries
                .filter((entry) => entry.startsWith("ms-dotnettools.csharp-"))
                .sort()
                .reverse();

            for (const ext of csharpExts) {
                const roslynDir = join(extensionsDir, ext, ".roslyn");
                const logDir = join(home, ".claude-ops", "logs", "roslyn");
                const roslynArgs = ["--stdio", "--logLevel", "Warning", "--extensionLogDirectory", logDir];

                const exePath = join(roslynDir, "Microsoft.CodeAnalysis.LanguageServer.exe");
                if (await fileExists(exePath)) {
                    return { command: [exePath, ...roslynArgs], tier: "vscode" };
                }

                const dllPath = join(roslynDir, "Microsoft.CodeAnalysis.LanguageServer.dll");
                if (await fileExists(dllPath)) {
                    const dotnet = Bun.which("dotnet") || (await fileExists("/usr/bin/dotnet") ? "/usr/bin/dotnet" : null);
                    if (dotnet) {
                        return { command: [dotnet, dllPath, ...roslynArgs], tier: "vscode" };
                    }
                }
            }
        } catch {
        }
    }

    const csharpLs = Bun.which("csharp-ls");
    if (csharpLs) return { command: [csharpLs], tier: "system" };

    const omnisharp = Bun.which("OmniSharp");
    if (omnisharp) return { command: [omnisharp, "-lsp"], tier: "system" };

    return null;
};

export async function resolveLspCommand(rootPath: string, language: string): Promise<ResolvedLspCommand> {
    const normalized = normalizeLspLanguage(language);
    if (!normalized) {
        throw new Error(`Language ${language} is not supported`);
    }

    if (normalized === "typescript" || normalized === "javascript") {
        const resolved = await resolveTypeScriptCommand(rootPath);
        if (resolved) return resolved;
    }

    if (normalized === "go") {
        const resolved = await resolveGoCommand();
        if (resolved) return resolved;
    }

    if (normalized === "python") {
        const pylsp = Bun.which("pylsp");
        if (pylsp) return { command: [pylsp], tier: "system" };
    }

    if (normalized === "c" || normalized === "cpp") {
        const resolved = await resolveCOrCppCommand();
        if (resolved) return resolved;
    }

    if (normalized === "csharp") {
        const resolved = await resolveCSharpCommand();
        if (resolved) return resolved;
    }

    throw new Error(`Language server for ${normalized} not found. Please install proper LSP support.`);
}

export interface LspAvailability {
    requestedLanguage: string;
    normalizedLanguage: NormalizedLspLanguage | null;
    supported: boolean;
    installed: boolean;
    resolverTier: LspResolverTier | null;
    command: string[] | null;
    missingReason: string | null;
}

export async function inspectLspAvailability(rootPath: string, language: string): Promise<LspAvailability> {
    const normalized = normalizeLspLanguage(language);
    if (!normalized) {
        return {
            requestedLanguage: language,
            normalizedLanguage: null,
            supported: false,
            installed: false,
            resolverTier: null,
            command: null,
            missingReason: `Language ${language} is not supported`,
        };
    }

    try {
        const resolved = await resolveLspCommand(rootPath, normalized);
        return {
            requestedLanguage: language,
            normalizedLanguage: normalized,
            supported: true,
            installed: true,
            resolverTier: resolved.tier,
            command: resolved.command,
            missingReason: null,
        };
    } catch (error) {
        return {
            requestedLanguage: language,
            normalizedLanguage: normalized,
            supported: true,
            installed: false,
            resolverTier: null,
            command: null,
            missingReason: error instanceof Error ? error.message : String(error),
        };
    }
}
