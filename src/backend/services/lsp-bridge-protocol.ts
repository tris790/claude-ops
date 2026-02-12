export interface LspSidecarStats {
    activeInstances: number;
    activeSessions: number;
    pendingRequests: number;
    timestamp: number;
}

export type MainToLspSidecarMessage =
    | { type: "open"; sessionId: string; rootPath: string; language: string }
    | { type: "message"; sessionId: string; payload: string }
    | { type: "close"; sessionId: string }
    | { type: "warmup"; rootPath: string }
    | { type: "stats" }
    | { type: "shutdown" };

export type LspSidecarToMainMessage =
    | { type: "ready"; pid: number; startedAt: number }
    | { type: "heartbeat"; ts: number; activeInstances: number; activeSessions: number; pendingRequests: number }
    | { type: "deliver"; sessionId: string; payload: string }
    | { type: "session-error"; sessionId: string; error: string }
    | { type: "stats"; data: LspSidecarStats }
    | { type: "fatal"; error: string };
