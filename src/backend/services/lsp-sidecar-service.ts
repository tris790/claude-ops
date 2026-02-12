import { join, relative, resolve } from "path";
import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { pathToFileURL } from "url";
import type { Subprocess, FileSink } from "bun";
import { normalizeLspLanguage, resolveLspCommand } from "./lsp-tools";

interface PendingClientRequest {
    sessionId: string;
    clientRequestId: string | number;
    timer: ReturnType<typeof setTimeout>;
}

export interface SidecarCallbacks {
    onDeliver: (sessionId: string, payload: string) => void;
    onSessionError: (sessionId: string, error: string) => void;
}

export interface SidecarOptions {
    requestTimeoutMs: number;
    maxQueueBytes: number;
    instanceInitTimeoutMs: number;
    circuitBreakerEnabled: boolean;
}

export interface LSPInstance {
    process: Subprocess<"pipe", "pipe", "pipe">;
    language: string;
    rootPath: string;
    clients: Set<string>;
    buffer: string;
    isInitialized: boolean;
    pendingNotifications: any[];
    lastUsed: number;
    pendingRequests: Map<string, PendingClientRequest>;
    pendingWriteQueue: string[];
    queuedBytes: number;
    writeDrainInProgress: boolean;
    consecutiveTimeouts: number;
    breakerOpenUntil: number;
    initTimer: ReturnType<typeof setTimeout> | null;
    isShuttingDown: boolean;
    reportedSessionErrors: Set<string>;
}

const MAX_LSP_PROCESSES = 3;
const LSP_TTL_MS = 5 * 60 * 1000;
const EVICTION_INTERVAL_MS = 60 * 1000;
const CIRCUIT_BREAKER_TIMEOUT_MS = 10_000;
const CONSECUTIVE_TIMEOUT_THRESHOLD = 3;
const CSHARP_WORKSPACE_SEARCH_MAX_DEPTH = 6;
const CSHARP_WORKSPACE_SEARCH_MAX_DIRS = 500;
const CSHARP_WORKSPACE_IGNORED_DIRS = new Set([
    ".git",
    ".hg",
    ".svn",
    ".vs",
    ".vscode",
    "node_modules",
    "bin",
    "obj",
    "packages",
]);

const DEFAULT_OPTIONS: SidecarOptions = {
    requestTimeoutMs: 6000,
    maxQueueBytes: 1024 * 1024,
    instanceInitTimeoutMs: 15000,
    circuitBreakerEnabled: true,
};

export class LSPSidecarService {
    private instances = new Map<string, LSPInstance>();
    private sessionToInstanceKey = new Map<string, string>();
    private restartingKeys = new Set<string>();
    private options: SidecarOptions;

    constructor(private callbacks: SidecarCallbacks, options: Partial<SidecarOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        setInterval(() => this.checkEviction(), EVICTION_INTERVAL_MS);
    }

    public getStats() {
        let pendingRequests = 0;
        for (const instance of this.instances.values()) {
            pendingRequests += instance.pendingRequests.size;
        }

        return {
            activeInstances: this.instances.size,
            activeSessions: this.sessionToInstanceKey.size,
            pendingRequests,
            timestamp: Date.now(),
        };
    }

    public async openSession(sessionId: string, rootPath: string, language: string) {
        const normalizedLanguage = normalizeLspLanguage(language) ?? language;
        const key = this.getInstanceKey(rootPath, normalizedLanguage);
        let instance = this.instances.get(key);

        if (!instance) {
            try {
                instance = await this.spawnServer(rootPath, normalizedLanguage);
                this.instances.set(key, instance);
                this.processOutput(instance, key);
                this.logStderr(instance);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                this.callbacks.onSessionError(sessionId, `Failed to spawn language server: ${message}`);
                return;
            }
        }

        instance.clients.add(sessionId);
        instance.lastUsed = Date.now();
        this.sessionToInstanceKey.set(sessionId, key);
    }

    public handleSessionMessage(sessionId: string, message: string | Buffer) {
        const key = this.sessionToInstanceKey.get(sessionId);
        if (!key) {
            this.callbacks.onSessionError(sessionId, "LSP session is not initialized");
            return;
        }

        const instance = this.instances.get(key);
        if (!instance) {
            this.callbacks.onSessionError(sessionId, "LSP instance not found");
            return;
        }

        instance.lastUsed = Date.now();

        const json = typeof message === "string" ? message : message.toString();
        let payload: any;

        try {
            payload = JSON.parse(json);
        } catch {
            this.forwardRawToProcess(instance, key, json);
            return;
        }

        if (this.isCircuitOpen(instance) && payload && payload.id !== undefined && payload.method) {
            this.sendRequestError(sessionId, payload.id, "LSP temporarily unavailable while restarting");
            return;
        }

        this.rewriteURIs(payload, (uri) => {
            if (!uri.startsWith("file:///")) return uri;
            const relativePath = uri.slice(8);
            const targetPath = join(instance.rootPath, relativePath.startsWith("/") ? relativePath.slice(1) : relativePath);
            return pathToFileURL(targetPath).toString();
        });

        if (payload && payload.id !== undefined && payload.method) {
            const internalId = `${sessionId}:${String(payload.id)}`;
            const existing = instance.pendingRequests.get(internalId);
            if (existing) {
                clearTimeout(existing.timer);
                instance.pendingRequests.delete(internalId);
            }

            const timeoutMs = instance.language === "csharp"
                ? this.options.requestTimeoutMs * 4
                : this.options.requestTimeoutMs;

            const timer = setTimeout(() => {
                this.onRequestTimeout(key, internalId);
            }, timeoutMs);

            instance.pendingRequests.set(internalId, {
                sessionId,
                clientRequestId: payload.id,
                timer,
            });
            payload.id = internalId;
        }

        if (!instance.isInitialized && payload.method !== "initialize") {
            instance.pendingNotifications.push(payload);
            return;
        }

        this.forwardRawToProcess(instance, key, JSON.stringify(payload));
    }

    public closeSession(sessionId: string) {
        const key = this.sessionToInstanceKey.get(sessionId);
        if (!key) return;

        this.sessionToInstanceKey.delete(sessionId);
        const instance = this.instances.get(key);
        if (!instance) return;

        instance.clients.delete(sessionId);
        instance.lastUsed = Date.now();

        const toDelete: string[] = [];
        for (const [requestKey, pending] of instance.pendingRequests.entries()) {
            if (pending.sessionId === sessionId) {
                clearTimeout(pending.timer);
                toDelete.push(requestKey);
            }
        }
        for (const requestKey of toDelete) {
            instance.pendingRequests.delete(requestKey);
        }
    }

    public async warmup(rootPath: string) {
        const language = await this.detectLanguage(rootPath);
        if (!language) return;

        const normalizedLanguage = normalizeLspLanguage(language) ?? language;
        const key = this.getInstanceKey(rootPath, normalizedLanguage);
        if (this.instances.has(key)) return;

        try {
            const instance = await this.spawnServer(rootPath, normalizedLanguage);
            this.instances.set(key, instance);
            this.processOutput(instance, key);
            this.logStderr(instance);
        } catch {
        }
    }

    public shutdown() {
        for (const [key, instance] of this.instances.entries()) {
            this.killInstance(key, instance, { preserveSessions: false, reason: "shutdown" });
        }
        this.instances.clear();
        this.sessionToInstanceKey.clear();
    }

    private isCircuitOpen(instance: LSPInstance) {
        return instance.breakerOpenUntil > Date.now();
    }

    private onRequestTimeout(key: string, internalId: string) {
        const instance = this.instances.get(key);
        if (!instance) return;

        const pending = instance.pendingRequests.get(internalId);
        if (!pending) return;

        clearTimeout(pending.timer);
        instance.pendingRequests.delete(internalId);
        instance.consecutiveTimeouts += 1;

        this.sendRequestError(pending.sessionId, pending.clientRequestId, "LSP request timed out");

        if (this.options.circuitBreakerEnabled && instance.consecutiveTimeouts >= CONSECUTIVE_TIMEOUT_THRESHOLD) {
            instance.breakerOpenUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT_MS;
            void this.restartInstance(key, "request timeout threshold exceeded");
        }
    }

    private sendRequestError(sessionId: string, id: string | number, message: string) {
        this.callbacks.onDeliver(sessionId, JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
                code: -32001,
                message,
            },
        }));
    }

    private async restartInstance(key: string, reason: string) {
        if (this.restartingKeys.has(key)) return;
        const current = this.instances.get(key);
        if (!current) return;

        this.restartingKeys.add(key);

        const sessions = [...current.clients];
        const rootPath = current.rootPath;
        const language = current.language;

        this.killInstance(key, current, { preserveSessions: true, reason });

        try {
            const replacement = await this.spawnServer(rootPath, language);
            replacement.clients = new Set(sessions);
            replacement.lastUsed = Date.now();
            this.instances.set(key, replacement);
            for (const sessionId of sessions) {
                this.sessionToInstanceKey.set(sessionId, key);
                this.callbacks.onSessionError(sessionId, `LSP server restarted: ${reason}`);
            }
            this.processOutput(replacement, key);
            this.logStderr(replacement);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            for (const sessionId of sessions) {
                this.sessionToInstanceKey.delete(sessionId);
                this.callbacks.onSessionError(sessionId, `LSP server restart failed: ${msg}`);
            }
        } finally {
            this.restartingKeys.delete(key);
        }
    }

    private checkEviction() {
        const now = Date.now();
        for (const [key, instance] of this.instances.entries()) {
            if (instance.clients.size === 0 && now - instance.lastUsed > LSP_TTL_MS) {
                this.killInstance(key, instance, { preserveSessions: false, reason: "idle eviction" });
            }
        }
    }

    private evictLRU() {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, instance] of this.instances.entries()) {
            if (instance.clients.size === 0 && instance.lastUsed < oldestTime) {
                oldestTime = instance.lastUsed;
                oldestKey = key;
            }
        }

        if (!oldestKey) {
            for (const [key, instance] of this.instances.entries()) {
                if (instance.lastUsed < oldestTime) {
                    oldestTime = instance.lastUsed;
                    oldestKey = key;
                }
            }
        }

        if (!oldestKey) return;
        const instance = this.instances.get(oldestKey);
        if (!instance) return;
        this.killInstance(oldestKey, instance, { preserveSessions: false, reason: "lru eviction" });
    }

    private killInstance(
        key: string,
        instance: LSPInstance,
        options: { preserveSessions: boolean; reason: string },
    ) {
        instance.isShuttingDown = true;

        for (const pending of instance.pendingRequests.values()) {
            clearTimeout(pending.timer);
            this.sendRequestError(pending.sessionId, pending.clientRequestId, `LSP request failed: ${options.reason}`);
        }
        instance.pendingRequests.clear();

        if (instance.initTimer) {
            clearTimeout(instance.initTimer);
            instance.initTimer = null;
        }

        if (!options.preserveSessions) {
            for (const sessionId of instance.clients) {
                this.sessionToInstanceKey.delete(sessionId);
            }
        }

        try {
            instance.process.kill();
        } catch {
        }

        this.instances.delete(key);
    }

    private async detectLanguage(rootPath: string): Promise<string> {
        try {
            if (await Bun.file(join(rootPath, "package.json")).exists()) return "typescript";
            if (await Bun.file(join(rootPath, "go.mod")).exists()) return "go";
            if (await Bun.file(join(rootPath, "requirements.txt")).exists()) return "python";
            if (await Bun.file(join(rootPath, "pyproject.toml")).exists()) return "python";
            if (await Bun.file(join(rootPath, "CMakeLists.txt")).exists()) return "cpp";
            const entries = await readdir(rootPath);
            if (entries.some((entry) => entry.endsWith(".csproj") || entry.endsWith(".sln"))) return "csharp";
        } catch {
        }

        return "";
    }

    private getInstanceKey(rootPath: string, language: string) {
        return `${rootPath}::${language}`;
    }

    private rewriteURIs(obj: any, rewriter: (uri: string) => string) {
        if (!obj || typeof obj !== "object") return;

        for (const key in obj) {
            const value = obj[key];
            if ((key === "uri" || key === "targetUri") && typeof value === "string") {
                obj[key] = rewriter(value);
            } else if (value && typeof value === "object") {
                this.rewriteURIs(value, rewriter);
            }
        }
    }

    private forwardRawToProcess(instance: LSPInstance, key: string, json: string) {
        const length = Buffer.byteLength(json, "utf-8");
        const packet = `Content-Length: ${length}\r\n\r\n${json}`;
        this.enqueuePacket(instance, key, packet);
    }

    private enqueuePacket(instance: LSPInstance, key: string, packet: string) {
        const packetBytes = Buffer.byteLength(packet, "utf-8");

        if (instance.queuedBytes + packetBytes > this.options.maxQueueBytes) {
            for (const sessionId of instance.clients) {
                this.callbacks.onSessionError(sessionId, "LSP backpressure limit reached, restarting server");
            }
            void this.restartInstance(key, "write queue overflow");
            return;
        }

        instance.pendingWriteQueue.push(packet);
        instance.queuedBytes += packetBytes;

        if (instance.writeDrainInProgress) return;
        instance.writeDrainInProgress = true;
        queueMicrotask(() => {
            void this.drainWriteQueue(instance, key);
        });
    }

    private async drainWriteQueue(instance: LSPInstance, key: string) {
        const stdin = instance.process.stdin as unknown as FileSink | null;
        if (!stdin) {
            instance.writeDrainInProgress = false;
            void this.restartInstance(key, "stdin unavailable");
            return;
        }

        let writes = 0;

        while (instance.pendingWriteQueue.length > 0) {
            const packet = instance.pendingWriteQueue.shift();
            if (!packet) continue;

            const packetBytes = Buffer.byteLength(packet, "utf-8");
            instance.queuedBytes = Math.max(0, instance.queuedBytes - packetBytes);

            try {
                stdin.write(packet);
            } catch {
                instance.writeDrainInProgress = false;
                void this.restartInstance(key, "write failure");
                return;
            }

            writes += 1;
            if (writes % 100 === 0) {
                await Bun.sleep(0);
            }
        }

        instance.writeDrainInProgress = false;
    }

    private sendToInstance(instance: LSPInstance, key: string, message: any) {
        this.forwardRawToProcess(instance, key, JSON.stringify(message));
    }

    private getWorkspaceFolder(rootPath: string) {
        const rootUri = pathToFileURL(rootPath).toString();
        const uri = rootUri.endsWith("/") ? rootUri : `${rootUri}/`;
        const name = rootPath.split(/[\\/]/).filter(Boolean).pop() || "root";
        return { name, uri };
    }

    private rankWorkspacePath(rootPath: string, candidate: string) {
        const rel = relative(rootPath, candidate).replace(/\\/g, "/");
        const depth = rel.split("/").length;
        return { depth, rel };
    }

    private pickWorkspacePath(rootPath: string, candidates: string[]) {
        if (!candidates.length) return null;
        const sorted = [...candidates].sort((a, b) => {
            const rankA = this.rankWorkspacePath(rootPath, a);
            const rankB = this.rankWorkspacePath(rootPath, b);
            if (rankA.depth !== rankB.depth) return rankA.depth - rankB.depth;
            if (rankA.rel.length !== rankB.rel.length) return rankA.rel.length - rankB.rel.length;
            return rankA.rel.localeCompare(rankB.rel);
        });
        return sorted[0] || null;
    }

    private async findCSharpWorkspaceTarget(rootPath: string) {
        const solutionCandidates: string[] = [];
        const projectCandidates: string[] = [];
        const queue: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }];
        let visitedDirs = 0;

        while (queue.length) {
            const current = queue.shift();
            if (!current) break;
            if (visitedDirs >= CSHARP_WORKSPACE_SEARCH_MAX_DIRS) break;
            visitedDirs += 1;

            let entries: Dirent[];
            try {
                entries = await readdir(current.dir, { withFileTypes: true, encoding: "utf8" });
            } catch {
                continue;
            }

            for (const entry of entries) {
                const fullPath = join(current.dir, entry.name);
                if (entry.isDirectory()) {
                    if (current.depth >= CSHARP_WORKSPACE_SEARCH_MAX_DEPTH) continue;
                    if (CSHARP_WORKSPACE_IGNORED_DIRS.has(entry.name)) continue;
                    queue.push({ dir: fullPath, depth: current.depth + 1 });
                    continue;
                }
                if (!entry.isFile()) continue;
                if (entry.name.endsWith(".sln")) {
                    solutionCandidates.push(fullPath);
                    continue;
                }
                if (entry.name.endsWith(".csproj")) {
                    projectCandidates.push(fullPath);
                }
            }
        }

        const preferredSolution = this.pickWorkspacePath(rootPath, solutionCandidates);
        if (preferredSolution) return preferredSolution;
        return this.pickWorkspacePath(rootPath, projectCandidates);
    }

    private async spawnServer(rootPath: string, language: string): Promise<LSPInstance> {
        const cmd = (await resolveLspCommand(rootPath, language)).command;

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
                NODE_OPTIONS: "--max-old-space-size=4096",
            },
        });

        const instance: LSPInstance = {
            process: lspProcess as Subprocess<"pipe", "pipe", "pipe">,
            language,
            rootPath,
            clients: new Set(),
            buffer: "",
            isInitialized: false,
            pendingNotifications: [],
            lastUsed: Date.now(),
            pendingRequests: new Map(),
            pendingWriteQueue: [],
            queuedBytes: 0,
            writeDrainInProgress: false,
            consecutiveTimeouts: 0,
            breakerOpenUntil: 0,
            initTimer: null,
            isShuttingDown: false,
            reportedSessionErrors: new Set(),
        };

        instance.initTimer = setTimeout(() => {
            const key = this.getInstanceKey(rootPath, language);
            if (!instance.isInitialized && this.instances.get(key) === instance) {
                for (const sessionId of instance.clients) {
                    this.callbacks.onSessionError(sessionId, "LSP initialization timed out, restarting server");
                }
                void this.restartInstance(key, "initialization timeout");
            }
        }, this.options.instanceInitTimeoutMs);

        const workspaceFolder = this.getWorkspaceFolder(rootPath);
        const rootUriWithSlash = workspaceFolder.uri;

        const initMsg = {
            jsonrpc: "2.0",
            id: "internal-init",
            method: "initialize",
            params: {
                processId: lspProcess.pid,
                rootPath,
                rootUri: rootUriWithSlash,
                workspaceFolders: [workspaceFolder],
                capabilities: {
                    textDocument: {
                        hover: { contentFormat: ["markdown", "plaintext"] },
                        publishDiagnostics: { relatedInformation: true },
                        definition: { dynamicRegistration: true, linkSupport: true },
                        typeDefinition: { dynamicRegistration: true, linkSupport: true },
                        implementation: { dynamicRegistration: true, linkSupport: true },
                        references: { dynamicRegistration: true },
                        documentSymbol: { dynamicRegistration: true, hierarchicalDocumentSymbolSupport: true },
                        codeAction: {
                            dynamicRegistration: true,
                            codeActionLiteralSupport: {
                                codeActionKind: {
                                    valueSet: ["", "quickfix", "refactor", "refactor.extract", "refactor.inline", "refactor.rewrite", "source", "source.organizeImports"],
                                },
                            },
                        },
                        rename: { dynamicRegistration: true, prepareSupport: true },
                        signatureHelp: {
                            dynamicRegistration: true,
                            signatureInformation: { documentationFormat: ["markdown", "plaintext"] },
                        },
                        completion: {
                            dynamicRegistration: true,
                            completionItem: {
                                snippetSupport: true,
                                commitCharactersSupport: true,
                                documentationFormat: ["markdown", "plaintext"],
                                deprecatedSupport: true,
                                preselectSupport: true,
                            },
                            contextSupport: true,
                        },
                    },
                    workspace: {
                        workspaceFolders: true,
                        configuration: true,
                        didChangeConfiguration: { dynamicRegistration: true },
                        didChangeWatchedFiles: { dynamicRegistration: true },
                        symbol: {
                            dynamicRegistration: true,
                            symbolKind: {
                                valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
                            },
                        },
                        executeCommand: { dynamicRegistration: true },
                    },
                },
                initializationOptions: {
                    preferences: {
                        includePackageJsonAutoImports: "auto",
                        importModuleSpecifierPreference: "non-relative",
                        includeExternalModuleExports: true,
                        includeInsertArgumentPlaceholders: true,
                    },
                    tsserver: {
                        logVerbosity: "normal",
                        path: await (async () => {
                            const projectTs = resolve(rootPath, "node_modules/typescript/lib/tsserver.js");
                            if (await Bun.file(projectTs).exists()) return projectTs;
                            const appTs = resolve(process.cwd(), "node_modules/typescript/lib/tsserver.js");
                            if (await Bun.file(appTs).exists()) return appTs;
                            return "tsserver";
                        })(),
                    },
                },
            },
        };

        const key = this.getInstanceKey(rootPath, language);
        this.sendToInstance(instance, key, initMsg);
        return instance;
    }

    private async openCSharpSolution(instance: LSPInstance, key: string) {
        try {
            const workspaceTarget = await this.findCSharpWorkspaceTarget(instance.rootPath);
            if (!workspaceTarget) return;

            this.sendToInstance(instance, key, {
                jsonrpc: "2.0",
                id: "internal-solution-open",
                method: "solution/open",
                params: { solution: pathToFileURL(workspaceTarget).toString() },
            });
        } catch {
        }
    }

    private async processOutput(instance: LSPInstance, key: string) {
        if (!instance.process.stdout) return;

        const stdout = instance.process.stdout as unknown as ReadableStream<Uint8Array>;
        const reader = stdout.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                instance.buffer += chunk;
                this.processBuffer(instance, key);
            }
        } catch {
        } finally {
            if (!instance.isShuttingDown && this.instances.get(key) === instance && instance.clients.size > 0) {
                void this.restartInstance(key, "stdout stream closed");
            }
        }
    }

    private processBuffer(instance: LSPInstance, key: string) {
        while (true) {
            const lowBuffer = instance.buffer.toLowerCase();
            const headerStartIndex = lowBuffer.indexOf("content-length:");
            if (headerStartIndex === -1) {
                if (instance.buffer.length > 1000) {
                    instance.buffer = "";
                }
                break;
            }

            if (headerStartIndex > 0) {
                instance.buffer = instance.buffer.slice(headerStartIndex);
            }

            const headerEndIndex = instance.buffer.indexOf("\r\n\r\n");
            if (headerEndIndex === -1) break;

            const headers = instance.buffer.slice(0, headerEndIndex);
            const contentLengthMatch = headers.match(/content-length:\s*(\d+)/i);
            if (!contentLengthMatch) {
                instance.buffer = instance.buffer.slice(headerEndIndex + 4);
                continue;
            }

            const contentLength = parseInt(contentLengthMatch[1] || "0", 10);
            const totalHeaderSize = headerEndIndex + 4;
            if (instance.buffer.length < totalHeaderSize + contentLength) break;

            const message = instance.buffer.slice(totalHeaderSize, totalHeaderSize + contentLength);
            instance.buffer = instance.buffer.slice(totalHeaderSize + contentLength);

            let payload: any;
            try {
                payload = JSON.parse(message);
            } catch {
                continue;
            }

            if (payload.id === "internal-init" && !instance.isInitialized) {
                if (instance.initTimer) {
                    clearTimeout(instance.initTimer);
                    instance.initTimer = null;
                }

                this.sendToInstance(instance, key, {
                    jsonrpc: "2.0",
                    method: "initialized",
                    params: {},
                });

                if (instance.language === "csharp") {
                    void this.openCSharpSolution(instance, key);
                }

                this.sendToInstance(instance, key, {
                    jsonrpc: "2.0",
                    method: "workspace/didChangeConfiguration",
                    params: {
                        settings: {
                            typescript: { tsserver: { logVerbosity: "normal" } },
                            javascript: { tsserver: { logVerbosity: "normal" } },
                        },
                    },
                });

                const delay = instance.language === "csharp" ? 3000 : 1000;
                setTimeout(() => {
                    for (const pending of instance.pendingNotifications) {
                        this.forwardRawToProcess(instance, key, JSON.stringify(pending));
                    }
                    instance.pendingNotifications = [];
                    instance.isInitialized = true;
                    instance.consecutiveTimeouts = 0;
                }, delay);
            }

            if (typeof payload.id === "string" && payload.id.startsWith("internal-")) {
                continue;
            }

            const requestId = typeof payload.id === "string" ? payload.id : null;
            if (requestId && instance.pendingRequests.has(requestId)) {
                const pending = instance.pendingRequests.get(requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    instance.pendingRequests.delete(requestId);
                    payload.id = pending.clientRequestId;
                    instance.consecutiveTimeouts = 0;
                    this.rewriteURIs(payload, (uri) => this.toClientUri(uri, instance.rootPath));
                    this.callbacks.onDeliver(pending.sessionId, JSON.stringify(payload));
                }
                continue;
            }

            if (payload.method && payload.id !== undefined) {
                if (payload.method === "workspace/configuration") {
                    const items = Array.isArray(payload.params?.items) ? payload.params.items : [];
                    this.sendToInstance(instance, key, {
                        jsonrpc: "2.0",
                        id: payload.id,
                        result: items.map(() => ({})),
                    });
                    continue;
                }

                if (payload.method === "client/registerCapability") {
                    this.sendToInstance(instance, key, {
                        jsonrpc: "2.0",
                        id: payload.id,
                        result: null,
                    });
                    continue;
                }

                if (payload.method === "workspace/workspaceFolders") {
                    this.sendToInstance(instance, key, {
                        jsonrpc: "2.0",
                        id: payload.id,
                        result: [this.getWorkspaceFolder(instance.rootPath)],
                    });
                    continue;
                }
            }

            this.rewriteURIs(payload, (uri) => this.toClientUri(uri, instance.rootPath));
            const finalMessage = JSON.stringify(payload);
            for (const sessionId of instance.clients) {
                this.callbacks.onDeliver(sessionId, finalMessage);
            }
        }
    }

    private toClientUri(uri: string, rootPath: string) {
        const rootUrl = pathToFileURL(rootPath).toString();
        const rootUrlPrefix = rootUrl.endsWith("/") ? rootUrl : `${rootUrl}/`;

        if (uri.startsWith(rootUrlPrefix)) {
            const rel = uri.slice(rootUrlPrefix.length);
            return `file:///${rel}`;
        }

        if (uri.startsWith(rootUrl)) {
            const rel = uri.slice(rootUrl.length);
            const normalizedRel = rel.startsWith("/") ? rel.slice(1) : rel;
            return `file:///${normalizedRel}`;
        }

        return uri;
    }

    private async logStderr(instance: LSPInstance) {
        if (!instance.process.stderr) return;

        const stderr = instance.process.stderr as unknown as ReadableStream<Uint8Array>;
        const reader = stderr.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                while (true) {
                    const newlineIndex = buffer.indexOf("\n");
                    if (newlineIndex === -1) break;

                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                    if (!line) continue;

                    this.maybeReportStderrIssue(instance, line);
                    if (!line.includes("[Informational]")) {
                        console.error(`[LSP STDERR] ${line.slice(0, 400)}`);
                    }
                }
            }

            const tail = buffer.trim();
            if (tail) {
                this.maybeReportStderrIssue(instance, tail);
                if (!tail.includes("[Informational]")) {
                    console.error(`[LSP STDERR] ${tail.slice(0, 400)}`);
                }
            }
        } catch {
        }
    }

    private maybeReportStderrIssue(instance: LSPInstance, line: string) {
        if (instance.language !== "csharp") return;

        const normalized = line.toLowerCase();
        const isLegacyMsbuildFailure =
            normalized.includes("mono msbuild could not be found") ||
            normalized.includes("msbuild failed when processing the file") ||
            normalized.includes("reference assemblies for .netframework");

        if (!isLegacyMsbuildFailure) return;

        const key = "csharp-legacy-msbuild";
        if (instance.reportedSessionErrors.has(key)) return;
        instance.reportedSessionErrors.add(key);

        for (const sessionId of instance.clients) {
            this.callbacks.onSessionError(
                sessionId,
                "C# IntelliSense unavailable: csharp-ls could not load this project. This repository appears to use legacy .NET Framework/MSBuild. Install Mono/MSBuild and .NET Framework targeting packs, or use an SDK-style project.",
            );
        }
    }
}
