import type { ServerWebSocket, Subprocess, FileSink } from "bun";
import { getSettings } from "./settings";
import type { MainToLspSidecarMessage, LspSidecarToMainMessage, LspSidecarStats } from "./lsp-bridge-protocol";

type SidecarStatus = "stopped" | "starting" | "healthy" | "degraded" | "restarting";

interface SessionState {
    ws: ServerWebSocket<any>;
    rootPath: string;
    language: string;
}

interface LspHealth {
    status: SidecarStatus;
    pid: number | null;
    restarts: number;
    lastHeartbeatAt: number | null;
    activeSessions: number;
    stats: LspSidecarStats;
}

const HEARTBEAT_TIMEOUT_MS = 12_000;
const HEARTBEAT_CHECK_INTERVAL_MS = 2_000;
const RESTART_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];

export class LSPService {
    private sidecar: Subprocess<"pipe", "pipe", "pipe"> | null = null;
    private status: SidecarStatus = "stopped";
    private lastHeartbeatAt = 0;
    private sidecarPid: number | null = null;
    private restartCount = 0;
    private restartAttempt = 0;
    private restarting = false;
    private spawnPromise: Promise<void> | null = null;
    private sessionBySocket = new WeakMap<ServerWebSocket<any>, string>();
    private sessions = new Map<string, SessionState>();
    private warmupQueue = new Set<string>();
    private lastStats: LspSidecarStats = {
        activeInstances: 0,
        activeSessions: 0,
        pendingRequests: 0,
        timestamp: 0,
    };

    constructor() {
        setInterval(() => this.checkHealth(), HEARTBEAT_CHECK_INTERVAL_MS);
    }

    handleConnection(ws: ServerWebSocket<any>, rootPath: string, language: string) {
        const sessionId = crypto.randomUUID();
        this.sessionBySocket.set(ws, sessionId);
        this.sessions.set(sessionId, { ws, rootPath, language });

        this.ensureSidecar();
        if (this.status === "healthy") {
            this.sendToSidecar({ type: "open", sessionId, rootPath, language });
        }
    }

    handleMessage(ws: ServerWebSocket<any>, _rootPath: string, _language: string, message: string | Buffer) {
        const sessionId = this.sessionBySocket.get(ws);
        if (!sessionId) return;

        this.ensureSidecar();

        const payload = typeof message === "string" ? message : message.toString();
        if (this.status !== "healthy") {
            this.failFastRequest(ws, payload, "LSP backend unavailable");
            return;
        }

        const sent = this.sendToSidecar({ type: "message", sessionId, payload });
        if (!sent) {
            this.failFastRequest(ws, payload, "LSP backend unavailable");
        }
    }

    handleClose(ws: ServerWebSocket<any>, _rootPath: string, _language: string) {
        const sessionId = this.sessionBySocket.get(ws);
        if (!sessionId) return;

        this.sessionBySocket.delete(ws);
        this.sessions.delete(sessionId);

        if (this.status === "healthy") {
            this.sendToSidecar({ type: "close", sessionId });
        }
    }

    async warmup(rootPath: string) {
        this.ensureSidecar();
        if (this.status === "healthy") {
            this.sendToSidecar({ type: "warmup", rootPath });
            return;
        }

        this.warmupQueue.add(rootPath);
    }

    getHealth(): LspHealth {
        return {
            status: this.status,
            pid: this.sidecarPid,
            restarts: this.restartCount,
            lastHeartbeatAt: this.lastHeartbeatAt || null,
            activeSessions: this.sessions.size,
            stats: this.lastStats,
        };
    }

    private failFastRequest(ws: ServerWebSocket<any>, payload: string, message: string) {
        try {
            const parsed = JSON.parse(payload);
            if (parsed && parsed.id !== undefined && parsed.method) {
                ws.send(JSON.stringify({
                    jsonrpc: "2.0",
                    id: parsed.id,
                    error: {
                        code: -32001,
                        message,
                    },
                }));
            }
        } catch {
        }
    }

    private ensureSidecar() {
        if (this.status === "healthy" || this.status === "starting" || this.status === "restarting") return;
        if (this.spawnPromise) return;

        this.spawnPromise = this.startSidecar().finally(() => {
            this.spawnPromise = null;
        });
    }

    private async startSidecar() {
        this.status = "starting";

        try {
            const settings = await getSettings().catch(() => null);
            const lsp = settings?.lsp;

            const proc = Bun.spawn([process.execPath, "src/backend/lsp-sidecar.ts"], {
                cwd: process.cwd(),
                stdin: "pipe",
                stdout: "pipe",
                stderr: "pipe",
                env: {
                    ...process.env,
                    LSP_REQUEST_TIMEOUT_MS: String(lsp?.requestTimeoutMs ?? 6000),
                    LSP_MAX_QUEUE_BYTES: String(lsp?.maxQueueBytes ?? 1024 * 1024),
                    LSP_INSTANCE_INIT_TIMEOUT_MS: String(lsp?.instanceInitTimeoutMs ?? 15000),
                    LSP_CIRCUIT_BREAKER_ENABLED: String(lsp?.circuitBreaker?.enabled ?? true),
                },
            });

            this.sidecar = proc as Subprocess<"pipe", "pipe", "pipe">;
            this.sidecarPid = proc.pid;

            void this.readSidecarStdout(this.sidecar);
            void this.readSidecarStderr(this.sidecar);
            void proc.exited.then(() => this.handleSidecarExit(proc as Subprocess<"pipe", "pipe", "pipe">));
        } catch {
            this.status = "degraded";
            this.scheduleRestart("sidecar spawn failed");
        }
    }

    private sendToSidecar(message: MainToLspSidecarMessage): boolean {
        if (!this.sidecar || this.status !== "healthy" || !this.sidecar.stdin) return false;

        try {
            const stdin = this.sidecar.stdin as unknown as FileSink;
            stdin.write(`${JSON.stringify(message)}\n`);
            return true;
        } catch {
            this.status = "degraded";
            this.scheduleRestart("sidecar write failure");
            return false;
        }
    }

    private async readSidecarStdout(proc: Subprocess<"pipe", "pipe", "pipe">) {
        if (!proc.stdout) return;

        const reader = (proc.stdout as unknown as ReadableStream<Uint8Array>).getReader();
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

                    let parsed: LspSidecarToMainMessage;
                    try {
                        parsed = JSON.parse(line) as LspSidecarToMainMessage;
                    } catch {
                        continue;
                    }

                    this.handleSidecarMessage(parsed);
                }
            }
        } catch {
        }
    }

    private async readSidecarStderr(proc: Subprocess<"pipe", "pipe", "pipe">) {
        if (!proc.stderr) return;

        const reader = (proc.stderr as unknown as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                if (text.trim()) {
                    console.error(`[LSP Sidecar] ${text.trimEnd()}`);
                }
            }
        } catch {
        }
    }

    private handleSidecarMessage(message: LspSidecarToMainMessage) {
        switch (message.type) {
            case "ready": {
                this.status = "healthy";
                this.sidecarPid = message.pid;
                this.lastHeartbeatAt = Date.now();
                this.restartAttempt = 0;
                this.syncSessions();
                this.flushWarmups();
                return;
            }
            case "heartbeat": {
                this.lastHeartbeatAt = message.ts;
                this.lastStats = {
                    activeInstances: message.activeInstances,
                    activeSessions: message.activeSessions,
                    pendingRequests: message.pendingRequests,
                    timestamp: message.ts,
                };
                if (this.status !== "healthy") this.status = "healthy";
                return;
            }
            case "deliver": {
                const session = this.sessions.get(message.sessionId);
                if (!session) return;
                try {
                    session.ws.send(message.payload);
                } catch {
                }
                return;
            }
            case "session-error": {
                const session = this.sessions.get(message.sessionId);
                if (!session) return;
                try {
                    session.ws.send(JSON.stringify({
                        jsonrpc: "2.0",
                        method: "window/logMessage",
                        params: { type: 1, message: message.error },
                    }));
                } catch {
                }
                return;
            }
            case "stats": {
                this.lastStats = message.data;
                return;
            }
            case "fatal": {
                this.status = "degraded";
                this.scheduleRestart(`sidecar fatal: ${message.error}`);
            }
        }
    }

    private syncSessions() {
        if (this.status !== "healthy") return;

        for (const [sessionId, session] of this.sessions.entries()) {
            this.sendToSidecar({
                type: "open",
                sessionId,
                rootPath: session.rootPath,
                language: session.language,
            });
        }
    }

    private flushWarmups() {
        if (this.status !== "healthy") return;

        for (const rootPath of this.warmupQueue) {
            this.sendToSidecar({ type: "warmup", rootPath });
        }
        this.warmupQueue.clear();
    }

    private checkHealth() {
        if (this.status !== "healthy") return;
        const now = Date.now();
        if (!this.lastHeartbeatAt || now - this.lastHeartbeatAt <= HEARTBEAT_TIMEOUT_MS) return;

        this.status = "degraded";
        this.scheduleRestart("sidecar heartbeat timeout");
    }

    private scheduleRestart(_reason: string) {
        if (this.restarting) return;

        this.restarting = true;
        this.status = "restarting";
        this.restartCount += 1;

        const delay = RESTART_BACKOFF_MS[Math.min(this.restartAttempt, RESTART_BACKOFF_MS.length - 1)] || 30000;
        this.restartAttempt += 1;

        const proc = this.sidecar;
        this.sidecar = null;
        this.sidecarPid = null;

        if (proc) {
            try {
                proc.kill();
            } catch {
            }
        }

        setTimeout(() => {
            this.restarting = false;
            this.status = "degraded";
            this.ensureSidecar();
        }, delay);
    }

    private handleSidecarExit(proc: Subprocess<"pipe", "pipe", "pipe">) {
        if (this.sidecar !== proc) return;
        this.sidecar = null;
        this.sidecarPid = null;

        if (this.status !== "stopped") {
            this.status = "degraded";
            this.scheduleRestart("sidecar exited");
        }
    }
}

export const lspService = new LSPService();
