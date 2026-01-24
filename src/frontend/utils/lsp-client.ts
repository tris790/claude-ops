export interface LSPMessage {
    jsonrpc: "2.0";
    id?: number;
    method?: string;
    params?: any;
    result?: any;
    error?: any;
}

export type LSPEventHandler = (params: any) => void;

export class LSPClient {
    private ws: WebSocket | null = null;
    private messageId = 0;
    private handlers = new Map<string, Set<LSPEventHandler>>();
    private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

    constructor(
        private projectName: string,
        private repoName: string,
        private language: string
    ) { }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const host = window.location.host;
            // Use query params: ?project=...&repo=...&language=...
            const url = `${protocol}//${host}/api/lsp?project=${encodeURIComponent(this.projectName)}&repo=${encodeURIComponent(this.repoName)}&language=${encodeURIComponent(this.language)}`;

            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log("[LSP] Connected");
                resolve();
            };

            this.ws.onerror = (err) => {
                console.error("[LSP] Connection error", err);
                reject(err);
            };

            this.ws.onclose = () => {
                console.log("[LSP] Disconnected");
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (e) {
                    console.error("[LSP] Failed to parse message", e);
                }
            };
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    on(method: string, handler: LSPEventHandler) {
        if (!this.handlers.has(method)) {
            this.handlers.set(method, new Set());
        }
        this.handlers.get(method)!.add(handler);
        return () => this.off(method, handler);
    }

    off(method: string, handler: LSPEventHandler) {
        const set = this.handlers.get(method);
        if (set) {
            set.delete(handler);
        }
    }

    sendNotification(method: string, params: any) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const msg: LSPMessage = {
            jsonrpc: "2.0",
            method,
            params
        };
        this.ws.send(JSON.stringify(msg));
    }

    sendRequest(method: string, params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error("LSP connection not open"));
            }

            const id = this.messageId++;
            this.pendingRequests.set(id, { resolve, reject });

            const msg: LSPMessage = {
                jsonrpc: "2.0",
                id,
                method,
                params
            };
            this.ws.send(JSON.stringify(msg));

            // Timeout after 5s?
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.get(id)?.reject(new Error("LSP request timed out"));
                    this.pendingRequests.delete(id);
                }
            }, 5000);
        });
    }

    private handleMessage(message: LSPMessage) {
        // Response
        if (typeof message.id === "number" && (message.result !== undefined || message.error !== undefined)) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                if (message.error) pending.reject(message.error);
                else pending.resolve(message.result);
                this.pendingRequests.delete(message.id);
            }
            return;
        }

        // Notification / Request from Server
        if (message.method) {
            const handlers = this.handlers.get(message.method);
            if (handlers) {
                handlers.forEach(h => h(message.params));
            }
        }
    }
}
