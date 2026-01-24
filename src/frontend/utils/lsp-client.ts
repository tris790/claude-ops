const REQUEST_TIMEOUT = 5000;

export interface LSPMessage {
    jsonrpc: "2.0";
    id?: number | string;
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
            const url = `${protocol}//${host}/api/lsp?project=${encodeURIComponent(this.projectName)}&repo=${encodeURIComponent(this.repoName)}&language=${encodeURIComponent(this.language)}`;

            this.ws = new WebSocket(url);

            this.ws.onopen = () => resolve();
            this.ws.onerror = (err) => reject(err);
            this.ws.onmessage = (event) => {
                try {
                    this.handleMessage(JSON.parse(event.data));
                } catch (e) {
                    // Ignore malformed messages
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
        this.handlers.get(method)?.delete(handler);
    }

    sendNotification(method: string, params: any) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method,
            params
        }));
    }

    sendRequest(method: string, params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error("LSP connection not open"));
            }

            const id = this.messageId++;
            this.pendingRequests.set(id, { resolve, reject });

            this.ws.send(JSON.stringify({
                jsonrpc: "2.0",
                id,
                method,
                params
            }));

            setTimeout(() => {
                const pending = this.pendingRequests.get(id);
                if (pending) {
                    pending.reject(new Error(`LSP request timed out: ${method}`));
                    this.pendingRequests.delete(id);
                }
            }, REQUEST_TIMEOUT);
        });
    }

    private sendResponse(id: number | string, result: any) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id,
            result
        }));
    }

    private handleMessage(message: LSPMessage) {
        // Response to client-initiated request
        if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
            const id = typeof message.id === 'string' ? parseInt(message.id, 10) : message.id;
            const pending = this.pendingRequests.get(id as number);

            if (pending) {
                if (message.error) pending.reject(message.error);
                else pending.resolve(message.result);
                this.pendingRequests.delete(id as number);
            }
            return;
        }

        // Notification / Request from Server
        if (message.method) {
            // Automatic responses to server requests
            if (message.id !== undefined) {
                if (message.method === 'workspace/configuration') {
                    const result = message.params?.items?.map(() => ({}));
                    this.sendResponse(message.id, result || []);
                } else if (message.method === 'client/registerCapability') {
                    this.sendResponse(message.id, null);
                } else if (message.method === 'workspace/workspaceFolders') {
                    this.sendResponse(message.id, []);
                }
            }

            this.handlers.get(message.method)?.forEach(h => h(message.params));
        }
    }
}

