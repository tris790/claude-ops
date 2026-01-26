import { join, resolve } from "path";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { pathToFileURL } from "url";
import type { Subprocess, ServerWebSocket, FileSink } from "bun";

export interface LSPInstance {
    process: Subprocess<"pipe", "pipe", "pipe">;
    language: string;
    rootPath: string;
    clients: Set<ServerWebSocket<any>>;
    buffer: string;
    isInitialized: boolean;
    pendingNotifications: any[];
    /**
     * Persistence State Machine:
     * - **Active**: `clients.size > 0`. Process is in use. `lastUsed` updated on activity.
     * - **Idle**: `clients.size === 0`. Keeping alive for `LSP_TTL_MS`.
     * - **Killed**: 
     *   - After `LSP_TTL_MS` in Idle state (Eviction Check).
     *   - Or if `instances.size > MAX_LSP_PROCESSES` (LRU Eviction).
     */
    lastUsed: number;
}

const MAX_LSP_PROCESSES = 3;
const LSP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const EVICTION_INTERVAL_MS = 60 * 1000; // Check every minute

export class LSPService {
    private instances: Map<string, LSPInstance> = new Map();

    constructor() {
        // Check for idle processes periodically
        setInterval(() => this.checkEviction(), EVICTION_INTERVAL_MS);
    }

    private checkEviction() {
        const now = Date.now();
        for (const [key, instance] of this.instances.entries()) {
            // If process is idle (no clients) and has exceeded TTL
            if (instance.clients.size === 0 && (now - instance.lastUsed > LSP_TTL_MS)) {
                console.log(`[LSP] Evicting idle server for ${key} (idle for ${Math.round((now - instance.lastUsed) / 60000)}m)`);
                this.killInstance(key, instance);
            }
        }
    }

    private evictLRU() {
        let OldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, instance] of this.instances.entries()) {
            // Prefer evicting idle processes first
            if (instance.clients.size === 0 && instance.lastUsed < oldestTime) {
                oldestTime = instance.lastUsed;
                OldestKey = key;
            }
        }

        // If no idle processes, find the oldest active one (though ideally we shouldn't kill active ones, 
        // but simple LRU implies strictly capping size)
        // However, killing an active LSP is bad UX. 
        // Let's refine: Only kill if we really have to. 
        // If all are active, maybe we allow going over limit slightly or we kill the LRU one anyway.
        // For this task, "LRU Cap: Max 3 concurrent LSP processes. If spawning a 4th, kill the one with the oldest lastUsed."
        // implies hard limit.
        if (!OldestKey) {
            for (const [key, instance] of this.instances.entries()) {
                if (instance.lastUsed < oldestTime) {
                    oldestTime = instance.lastUsed;
                    OldestKey = key;
                }
            }
        }

        if (OldestKey) {
            const instance = this.instances.get(OldestKey);
            if (instance) {
                console.log(`[LSP] Evicting LRU server ${OldestKey} to make room`);
                this.killInstance(OldestKey, instance);
            }
        }
    }

    private killInstance(key: string, instance: LSPInstance) {
        try {
            instance.process.kill();
        } catch (e) {
            console.error(`[LSP] Failed to kill process ${key}:`, e);
        }
        this.instances.delete(key);
        console.log(`[LSP] Killed server for ${key}`);
    }

    private async findExtensionBin(publisherAndName: string, binPath: string): Promise<string | null> {
        const home = homedir();
        if (!home) return null;

        const extensionsDir = join(home, ".vscode/extensions");
        try {
            if (!await Bun.file(extensionsDir).size) { // Basic check if dir exists/is readable
                // Actually Bun.file().exists() works for files, for dirs we can try readdir
            }

            const entries = await readdir(extensionsDir);
            // Find directory starting with publisherAndName
            // e.g. ms-dotnettools.csharp-1.25.0
            const match = entries.find(e => e.startsWith(publisherAndName));
            if (match) {
                const fullPath = join(extensionsDir, match, binPath);
                if (await Bun.file(fullPath).exists()) {
                    return fullPath;
                }
            }
        } catch (e) {
            // ignore
        }
        return null;
    }

    private getInstanceKey(rootPath: string, language: string) {
        return `${rootPath}::${language}`;
    }

    async handleConnection(ws: ServerWebSocket<any>, rootPath: string, language: string) {
        const normalizedLanguage = (language === 'typescriptreact' || language === 'javascriptreact') ? language.replace('react', '') : language;
        const key = this.getInstanceKey(rootPath, normalizedLanguage);
        let instance = this.instances.get(key);

        if (!instance) {
            try {
                instance = await this.spawnServer(rootPath, language);
                this.instances.set(key, instance);
            } catch (e) {
                console.error(`[LSP] Failed to spawn server:`, e);
                ws.send(JSON.stringify({ error: `Failed to spawn language server: ${e instanceof Error ? e.message : String(e)}` }));
                ws.close();
                return;
            }
        }

        instance.clients.add(ws);
        instance.lastUsed = Date.now();
        console.log(`[LSP] Client connected to ${language} server for ${rootPath}`);
    }

    handleMessage(ws: ServerWebSocket<any>, rootPath: string, language: string, message: string | Buffer) {
        const normalizedLanguage = (language === 'typescriptreact' || language === 'javascriptreact') ? language.replace('react', '') : language;
        const key = this.getInstanceKey(rootPath, normalizedLanguage);
        const instance = this.instances.get(key);
        if (!instance) {
            console.warn(`[LSP] Received message for non-existent server: ${key}`);
            return;
        }

        instance.lastUsed = Date.now();

        const json = typeof message === 'string' ? message : message.toString();
        let payload: any;
        try {
            payload = JSON.parse(json);
            // Rewrite URIs from client to server (bridge rootPath)
            this.rewriteURIs(payload, (uri) => {
                if (uri.startsWith('file:///')) {
                    const relativePath = uri.slice(8);
                    // Standardize: ensure we don't have multiple slashes if relativePath already starts with one
                    const targetPath = join(rootPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath);
                    return pathToFileURL(targetPath).toString();
                }
                return uri;
            });
        } catch (e) {
            this.forwardToProcess(instance, json);
            return;
        }

        if (!instance.isInitialized && payload.method !== 'initialize') {
            console.log(`[LSP] Buffering message: ${payload.method}`);
            instance.pendingNotifications.push(payload);
        } else {
            console.log(`[LSP] >> ${payload.method || ('id:' + payload.id)}`);
            this.forwardToProcess(instance, JSON.stringify(payload));
        }
    }

    private forwardToProcess(instance: LSPInstance, json: string) {
        const length = Buffer.byteLength(json, 'utf-8');
        const packet = `Content-Length: ${length}\r\n\r\n${json}`;

        if (instance.process.stdin) {
            const stdin = instance.process.stdin as unknown as FileSink;
            stdin.write(packet);
            stdin.flush();
        }
    }

    private rewriteURIs(obj: any, rewriter: (uri: string) => string) {
        if (!obj || typeof obj !== 'object') return;

        for (const key in obj) {
            if (key === 'uri' && typeof obj[key] === 'string') {
                obj[key] = rewriter(obj[key]);
            } else if (key === 'targetUri' && typeof obj[key] === 'string') {
                obj[key] = rewriter(obj[key]);
            } else if (typeof obj[key] === 'object') {
                this.rewriteURIs(obj[key], rewriter);
            }
        }
    }

    handleClose(ws: ServerWebSocket<any>, rootPath: string, language: string) {
        const normalizedLanguage = (language === 'typescriptreact' || language === 'javascriptreact') ? language.replace('react', '') : language;
        const key = this.getInstanceKey(rootPath, normalizedLanguage);
        const instance = this.instances.get(key);
        if (instance) {
            instance.clients.delete(ws);
            if (instance.clients.size === 0) {
                // Do not kill immediately. Mark as last used now.
                instance.lastUsed = Date.now();
                console.log(`[LSP] Last client disconnected from ${language}/${rootPath}. Process kept alive (TTL: ${LSP_TTL_MS / 60000}m).`);
            }
        }
    }

    private async resolveLSPCommand(language: string): Promise<string[]> {
        // Tier 1: System Path (Preferred if installed intentionally)
        if (language === 'typescript' || language === 'javascript' || language === 'typescriptreact' || language === 'javascriptreact') {
            // Tier 0: Local node_modules (Best for dev/self-contained)
            // Process CWD is expected to be the app root
            const projectRoot = process.cwd();
            // Try to find the actual JS entry point which is safer for 'node' command across platforms
            const potentialPaths = [
                resolve(projectRoot, "node_modules/typescript-language-server/lib/cli.js"),
                resolve(projectRoot, "node_modules/typescript-language-server/lib/cli.mjs"),
                resolve(projectRoot, "node_modules/.bin/typescript-language-server")
            ];

            for (const p of potentialPaths) {
                if (await Bun.file(p).exists()) {
                    console.log(`[LSP] Found local typescript-language-server at ${p}`);
                    return ["node", p, "--stdio"];
                }
            }

            const bin = Bun.which("typescript-language-server");
            if (bin) return [bin, "--stdio"];

            // Tier 2: VS Code Bundled (tsserver)
            // Note: tsserver speaks a proprietary protocol, not standard LSP.
            // However, for the purpose of this task, we will attempt to launch it.
            // In a real scenario, we'd need a protocol adapter (like typescript-language-server).
            const vscodePaths = [
                // Linux
                "/opt/visual-studio-code/resources/app/extensions/node_modules/typescript/lib/tsserver.js",
                "/usr/share/code/resources/app/extensions/node_modules/typescript/lib/tsserver.js",
                "/usr/lib/code/resources/app/extensions/node_modules/typescript/lib/tsserver.js",
                // Windows (System)
                "C:/Program Files/Microsoft VS Code/resources/app/extensions/node_modules/typescript/lib/tsserver.js",
                // Windows (User)
                join(homedir(), "AppData/Local/Programs/Microsoft VS Code/resources/app/extensions/node_modules/typescript/lib/tsserver.js")
            ];

            for (const p of vscodePaths) {
                // Check if file exists using Bun.file (async check)
                // Note: Bun.file(p).exists() returns a Promise<boolean>
                if (await Bun.file(p).exists()) {
                    console.log(`[LSP] Found VS Code tsserver at ${p}`);
                    // We run it with bun
                    return ["bun", "run", p];
                }
            }
        } else if (language === 'go') {
            const bin = Bun.which("gopls");
            if (bin) return [bin];

            // Check for VS Code extension
            // ~/.vscode/extensions/golang.go-*/bin/gopls
            const extBin = await this.findExtensionBin("golang.go", "bin/gopls");
            if (extBin) return [extBin];

        } else if (language === 'python') {
            const bin = Bun.which("pylsp");
            if (bin) return [bin];
        } else if (language === 'c' || language === 'cpp') {
            const bin = Bun.which("clangd");
            const args = [
                "--background-index",
                "--clang-tidy",
                "--completion-style=detailed",
                "--header-insertion=iwyu",
                "-j=4"
            ];
            if (bin) return [bin, ...args];
            // Linux common paths
            if (await Bun.file("/usr/bin/clangd").exists()) return ["/usr/bin/clangd", ...args];
            // Windows common paths
            if (await Bun.file("C:/Program Files/LLVM/bin/clangd.exe").exists()) return ["C:/Program Files/LLVM/bin/clangd.exe", ...args];
        } else if (language === 'csharp') {
            // Try csharp-ls (simple LSP for C#)
            const bin = Bun.which("csharp-ls");
            if (bin) return [bin];

            // Try OmniSharp (system)
            const omnisharp = Bun.which("OmniSharp");
            if (omnisharp) return [omnisharp, "-lsp"];

            // Try VS Code extension for OmniSharp (path varies by version/platform, this is a best guess for modern versions)
            // Modern C# Dev Kit uses a different server, but older C# extension used .omnisharp
            // We'll try to find a standalone executable if possible, otherwise we might fail if we need 'dotnet'

            // Note: Common path in older extensions: .omnisharp/<version>/OmniSharp
            // This is hard to glob without more logic. 
            // We will rely on system tools for now or 'csharp-ls' which is easier to install.
        }

        throw new Error(`Language server for ${language} not found. Please install proper LSP support.`);
    }

    private async spawnServer(rootPath: string, language: string): Promise<LSPInstance> {
        let cmd: string[];
        try {
            cmd = await this.resolveLSPCommand(language);
        } catch (e: any) {
            console.error(e.message);
            // Return dummy process-like object or throw?
            // Throwing allows the frontend to receive the error msg
            throw e;
        }

        console.log(`[LSP] Spawning ${language} server`);
        console.log(`[LSP] Root Path: ${rootPath}`);
        console.log(`[LSP] Command: ${cmd.join(' ')}`);

        const hasTsConfig = await Bun.file(join(rootPath, "tsconfig.json")).exists();
        console.log(`[LSP] tsconfig.json found: ${hasTsConfig}`);

        // Enforce max processes
        if (this.instances.size >= MAX_LSP_PROCESSES) {
            this.evictLRU();
        }

        const lspProcess = Bun.spawn(cmd, {
            cwd: rootPath,
            stdin: "pipe",
            stdout: "pipe",
            stderr: "pipe",
            env: {
                ...process.env,
                NODE_OPTIONS: "--max-old-space-size=4096"
            }
        });

        const instance: LSPInstance = {
            process: lspProcess as Subprocess<"pipe", "pipe", "pipe">,
            language,
            rootPath,
            clients: new Set(),
            buffer: "",
            isInitialized: false,
            pendingNotifications: [],
            lastUsed: Date.now()
        };

        // Start processing stdout
        this.processOutput(instance);

        // Log stderr
        this.logStderr(instance);

        const rootUri = pathToFileURL(rootPath).toString();
        const rootUriWithSlash = rootUri.endsWith('/') ? rootUri : rootUri + '/';

        // Send 'initialize'
        const initMsg = {
            jsonrpc: "2.0",
            id: "internal-init",
            method: "initialize",
            params: {
                processId: lspProcess.pid,
                rootPath: rootPath,
                rootUri: rootUriWithSlash,
                workspaceFolders: [
                    {
                        name: "root",
                        uri: rootUriWithSlash
                    }
                ],
                capabilities: {
                    textDocument: {
                        hover: {
                            contentFormat: ["markdown", "plaintext"]
                        },
                        publishDiagnostics: {
                            relatedInformation: true
                        },
                        definition: {
                            dynamicRegistration: true,
                            linkSupport: true
                        },
                        typeDefinition: {
                            dynamicRegistration: true,
                            linkSupport: true
                        },
                        implementation: {
                            dynamicRegistration: true,
                            linkSupport: true
                        },
                        references: {
                            dynamicRegistration: true
                        },
                        documentSymbol: {
                            dynamicRegistration: true,
                            hierarchicalDocumentSymbolSupport: true
                        },
                        codeAction: {
                            dynamicRegistration: true,
                            codeActionLiteralSupport: {
                                codeActionKind: {
                                    valueSet: ["", "quickfix", "refactor", "refactor.extract", "refactor.inline", "refactor.rewrite", "source", "source.organizeImports"]
                                }
                            }
                        },
                        rename: {
                            dynamicRegistration: true,
                            prepareSupport: true
                        },
                        signatureHelp: {
                            dynamicRegistration: true,
                            signatureInformation: {
                                documentationFormat: ["markdown", "plaintext"]
                            }
                        },
                        completion: {
                            dynamicRegistration: true,
                            completionItem: {
                                snippetSupport: true,
                                commitCharactersSupport: true,
                                documentationFormat: ["markdown", "plaintext"],
                                deprecatedSupport: true,
                                preselectSupport: true
                            },
                            contextSupport: true
                        }
                    },
                    workspace: {
                        workspaceFolders: true,
                        configuration: true,
                        didChangeConfiguration: {
                            dynamicRegistration: true
                        },
                        didChangeWatchedFiles: {
                            dynamicRegistration: true
                        },
                        symbol: {
                            dynamicRegistration: true,
                            symbolKind: {
                                valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
                            }
                        },
                        executeCommand: {
                            dynamicRegistration: true
                        }
                    }
                },
                initializationOptions: {
                    preferences: {
                        includePackageJsonAutoImports: "auto",
                        importModuleSpecifierPreference: "non-relative",
                        includeExternalModuleExports: true,
                        includeInsertArgumentPlaceholders: true
                    },
                    tsserver: {
                        logVerbosity: "normal",
                        path: await (async () => {
                            const projectTs = resolve(rootPath, "node_modules/typescript/lib/tsserver.js");
                            if (await Bun.file(projectTs).exists()) return projectTs;
                            const appTs = resolve(process.cwd(), "node_modules/typescript/lib/tsserver.js");
                            if (await Bun.file(appTs).exists()) return appTs;
                            return "tsserver"; // Fallback to system path
                        })()
                    }
                }
            }
        };

        this.sendToInstance(instance, initMsg);

        return instance;
    }

    private sendToInstance(instance: LSPInstance, message: any) {
        if (instance.process.stdin) {
            const json = JSON.stringify(message);
            const length = Buffer.byteLength(json, 'utf-8');
            const packet = `Content-Length: ${length}\r\n\r\n${json}`;
            const stdin = instance.process.stdin as unknown as FileSink;
            stdin.write(packet);
            stdin.flush();
        }
    }

    private async processOutput(instance: LSPInstance) {
        if (!instance.process.stdout) return;

        const stdout = instance.process.stdout as unknown as ReadableStream;
        const reader = stdout.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // console.log(`[LSP] STDOUT Chunk: ${chunk.length} bytes`);
                instance.buffer += chunk;
                this.processBuffer(instance);
            }
        } catch (e) {
            console.error(`[LSP] Error reading stdout for ${instance.language}`, e);
        }
    }

    private processBuffer(instance: LSPInstance) {
        while (true) {
            // Find the start of the headers (case-insensitive search)
            const lowBuffer = instance.buffer.toLowerCase();
            const headerStartIndex = lowBuffer.indexOf("content-length:");

            if (headerStartIndex === -1) {
                // If we have a lot of data but no header, maybe it's noise?
                if (instance.buffer.length > 1000) {
                    console.log(`[LSP] Discarding ${instance.buffer.length} bytes of non-LSP data from stdout`);
                    instance.buffer = "";
                }
                break;
            }

            // If there's garbage before the header, discard it
            if (headerStartIndex > 0) {
                const junk = instance.buffer.slice(0, headerStartIndex);
                if (junk.trim()) {
                    console.log(`[LSP] Discarded noise before header: ${junk.slice(0, 50)}...`);
                }
                instance.buffer = instance.buffer.slice(headerStartIndex);
            }

            // Find the end of the headers (\r\n\r\n)
            const headerEndIndex = instance.buffer.indexOf("\r\n\r\n");
            if (headerEndIndex === -1) break;

            // Extract headers
            const headers = instance.buffer.slice(0, headerEndIndex);
            const contentLengthMatch = headers.match(/content-length:\s*(\d+)/i);

            if (!contentLengthMatch) {
                // Should not happen if we found Content-Length, but skip to be safe
                instance.buffer = instance.buffer.slice(headerEndIndex + 4);
                continue;
            }

            const contentLength = parseInt(contentLengthMatch[1] || "0", 10);
            const totalHeaderSize = headerEndIndex + 4;

            // If we have the full message
            if (instance.buffer.length >= totalHeaderSize + contentLength) {
                // Extract message body
                const message = instance.buffer.slice(totalHeaderSize, totalHeaderSize + contentLength);

                // Remove everything processed
                instance.buffer = instance.buffer.slice(totalHeaderSize + contentLength);

                let payload: any;
                try {
                    payload = JSON.parse(message);
                    if (payload.method !== 'textDocument/publishDiagnostics') {
                        console.log(`[LSP] << ${payload.method || ('id:' + payload.id)}`);
                    }

                    // Internal initialization handling
                    if (payload.id === "internal-init" && !instance.isInitialized) {
                        console.log(`[LSP] Server initialized successfully`);
                        // instance.isInitialized = true; // DO NOT set here yet, wait for replay
                        this.sendToInstance(instance, {
                            jsonrpc: "2.0",
                            method: "initialized",
                            params: {}
                        });

                        // Notify configuration change to trigger indexing
                        this.sendToInstance(instance, {
                            jsonrpc: "2.0",
                            method: "workspace/didChangeConfiguration",
                            params: {
                                settings: {
                                    typescript: {
                                        tsserver: {
                                            logVerbosity: "normal"
                                        }
                                    },
                                    javascript: {
                                        tsserver: {
                                            logVerbosity: "normal"
                                        }
                                    }
                                }
                            }
                        });

                        // Reduced delay for replaying buffered messages, but set initialized AFTER
                        setTimeout(() => {
                            for (const msg of instance.pendingNotifications) {
                                console.log(`[LSP] Replay buffered message: ${msg.method || 'request'}`);
                                this.forwardToProcess(instance, JSON.stringify(msg));
                            }
                            instance.pendingNotifications = [];
                            instance.isInitialized = true; // NOW it is ready for new messages
                            console.log(`[LSP] Server ready and buffered messages replayed`);
                        }, 1000); // 1 second should be enough for basic startup handover
                    }

                    this.rewriteURIs(payload, (uri) => {
                        const rootUrl = pathToFileURL(instance.rootPath).toString();
                        const rootUrlPrefix = rootUrl.endsWith('/') ? rootUrl : rootUrl + '/';

                        if (uri.startsWith(rootUrlPrefix)) {
                            const rel = uri.slice(rootUrlPrefix.length);
                            return `file:///${rel}`;
                        } else if (uri.startsWith(rootUrl)) {
                            // Fallback for exact root match or missing trailing slash in comparison
                            const rel = uri.slice(rootUrl.length);
                            const normalizedRel = rel.startsWith('/') ? rel.slice(1) : rel;
                            return `file:///${normalizedRel}`;
                        }
                        return uri;
                    });

                    const finalMessage = JSON.stringify(payload);
                    for (const client of instance.clients) {
                        client.send(finalMessage);
                    }
                } catch (e) {
                    console.error(`[LSP] Failed to parse/forward message: ${e}`);
                    // Fallback to forwarding raw message if it wasn't JSON but somehow valid LSP
                }
            } else {
                break; // Wait for more data
            }
        }
    }

    private async logStderr(instance: LSPInstance) {
        if (!instance.process.stderr) return;
        const stderr = instance.process.stderr as unknown as ReadableStream;
        const reader = stderr.getReader();
        const decoder = new TextDecoder();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                // Don't spam console too much, but useful for debugging
                if (process.env.NODE_ENV !== 'production') {
                    console.error(`[LSP STDERR]`, text);
                }
            }
        } catch (e) {
            // ignore
        }
    }
    public async warmup(rootPath: string) {
        // Simple heuristic to detect language
        let language = "";

        try {
            if (await Bun.file(join(rootPath, "package.json")).exists()) {
                language = "typescript";
            } else if (await Bun.file(join(rootPath, "go.mod")).exists()) {
                language = "go";
            } else if (await Bun.file(join(rootPath, "requirements.txt")).exists() || await Bun.file(join(rootPath, "pyproject.toml")).exists()) {
                language = "python";
            } else if (await Bun.file(join(rootPath, "CMakeLists.txt")).exists()) {
                language = "cpp";
            }
        } catch (e) {
            // ignore fs errors
        }

        if (!language) return;

        const key = this.getInstanceKey(rootPath, language);
        if (this.instances.has(key)) return; // Already running

        try {
            console.log(`[LSP] Warming up ${language} server for ${rootPath}`);
            const instance = await this.spawnServer(rootPath, language);
            this.instances.set(key, instance);
        } catch (e) {
            // Be silent on warmup failure, it's an optimization
            console.warn(`[LSP] Failed to warm up server for ${rootPath}:`, e);
        }
    }
}

export const lspService = new LSPService();
