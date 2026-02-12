import { inspect } from "node:util";
import type { LspSidecarToMainMessage, MainToLspSidecarMessage } from "./services/lsp-bridge-protocol";
import { LSPSidecarService } from "./services/lsp-sidecar-service";

const writeStderr = (...args: any[]) => {
    const text = args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 4, colors: false }))).join(" ");
    process.stderr.write(`${text}\n`);
};

console.log = writeStderr;
console.info = writeStderr;

const HEARTBEAT_INTERVAL_MS = 5000;

const requestTimeoutMs = Number(process.env.LSP_REQUEST_TIMEOUT_MS || "6000");
const maxQueueBytes = Number(process.env.LSP_MAX_QUEUE_BYTES || `${1024 * 1024}`);
const instanceInitTimeoutMs = Number(process.env.LSP_INSTANCE_INIT_TIMEOUT_MS || "15000");
const circuitBreakerEnabled = process.env.LSP_CIRCUIT_BREAKER_ENABLED !== "false";

const send = (message: LspSidecarToMainMessage) => {
    process.stdout.write(`${JSON.stringify(message)}\n`);
};

const service = new LSPSidecarService(
    {
        onDeliver: (sessionId, payload) => send({ type: "deliver", sessionId, payload }),
        onSessionError: (sessionId, error) => send({ type: "session-error", sessionId, error }),
    },
    {
        requestTimeoutMs: Number.isFinite(requestTimeoutMs) ? requestTimeoutMs : 6000,
        maxQueueBytes: Number.isFinite(maxQueueBytes) ? maxQueueBytes : 1024 * 1024,
        instanceInitTimeoutMs: Number.isFinite(instanceInitTimeoutMs) ? instanceInitTimeoutMs : 15000,
        circuitBreakerEnabled,
    },
);

send({ type: "ready", pid: process.pid, startedAt: Date.now() });

const heartbeat = setInterval(() => {
    const stats = service.getStats();
    send({
        type: "heartbeat",
        ts: Date.now(),
        activeInstances: stats.activeInstances,
        activeSessions: stats.activeSessions,
        pendingRequests: stats.pendingRequests,
    });
}, HEARTBEAT_INTERVAL_MS);

const handleMessage = async (message: MainToLspSidecarMessage) => {
    switch (message.type) {
        case "open":
            await service.openSession(message.sessionId, message.rootPath, message.language);
            return;
        case "message":
            service.handleSessionMessage(message.sessionId, message.payload);
            return;
        case "close":
            service.closeSession(message.sessionId);
            return;
        case "warmup":
            await service.warmup(message.rootPath);
            return;
        case "stats":
            send({ type: "stats", data: service.getStats() });
            return;
        case "shutdown":
            clearInterval(heartbeat);
            service.shutdown();
            process.exit(0);
    }
};

const parseAndHandleLine = async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let parsed: MainToLspSidecarMessage;
    try {
        parsed = JSON.parse(trimmed) as MainToLspSidecarMessage;
    } catch {
        return;
    }

    try {
        await handleMessage(parsed);
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        send({ type: "fatal", error });
    }
};

const stream = Bun.stdin.stream();
const reader = stream.getReader();
const decoder = new TextDecoder();
let buffer = "";

const readLoop = async () => {
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            while (true) {
                const newlineIndex = buffer.indexOf("\n");
                if (newlineIndex === -1) break;

                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);
                await parseAndHandleLine(line);
            }
        }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        send({ type: "fatal", error });
    } finally {
        clearInterval(heartbeat);
        service.shutdown();
        process.exit(0);
    }
};

process.on("SIGTERM", () => {
    clearInterval(heartbeat);
    service.shutdown();
    process.exit(0);
});

process.on("SIGINT", () => {
    clearInterval(heartbeat);
    service.shutdown();
    process.exit(0);
});

void readLoop();
