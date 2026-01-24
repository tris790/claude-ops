import type { Subprocess, ServerWebSocket, FileSink } from "bun";

export interface LSPInstance {
    process: Subprocess<"pipe", "pipe", "pipe">;
    language: string;
    rootPath: string;
    clients: Set<ServerWebSocket<any>>;
    buffer: string;
}

export class LSPService {
    private instances: Map<string, LSPInstance> = new Map();

    private getInstanceKey(rootPath: string, language: string) {
        return `${rootPath}::${language}`;
    }

    async handleConnection(ws: ServerWebSocket<any>, rootPath: string, language: string) {
        const key = this.getInstanceKey(rootPath, language);
        let instance = this.instances.get(key);

        if (!instance) {
            try {
                instance = await this.spawnServer(rootPath, language);
                this.instances.set(key, instance);
            } catch (e) {
                console.error(`[LSP] Failed to spawn server:`, e);
                ws.send(JSON.stringify({ error: "Failed to spawn language server" }));
                ws.close();
                return;
            }
        }

        instance.clients.add(ws);
        console.log(`[LSP] Client connected to ${language} server for ${rootPath}`);
    }

    handleMessage(ws: ServerWebSocket<any>, rootPath: string, language: string, message: string | Buffer) {
        const key = this.getInstanceKey(rootPath, language);
        const instance = this.instances.get(key);
        if (!instance) {
            console.warn(`[LSP] Received message for non-existent server: ${key}`);
            return;
        }

        // Assuming message is the JSON payload from the client
        // We need to wrap it with LSP headers
        const json = typeof message === 'string' ? message : message.toString();
        const length = Buffer.byteLength(json, 'utf-8');
        const packet = `Content-Length: ${length}\r\n\r\n${json}`;

        // Write to stdin
        if (instance.process.stdin) {
            const stdin = instance.process.stdin as unknown as FileSink;
            stdin.write(packet);
            stdin.flush();
        }
    }

    handleClose(ws: ServerWebSocket<any>, rootPath: string, language: string) {
        const key = this.getInstanceKey(rootPath, language);
        const instance = this.instances.get(key);
        if (instance) {
            instance.clients.delete(ws);
            if (instance.clients.size === 0) {
                // We could kill the server here if we want to save resources
                // instance.process.kill();
                // this.instances.delete(key);
                console.log(`[LSP] Last client disconnected from ${language}/${rootPath}`);
            }
        }
    }

    private async spawnServer(rootPath: string, language: string): Promise<LSPInstance> {
        let cmd: string[] = [];

        // Tier 1: System Check only for now
        if (language === 'typescript' || language === 'javascript') {
            const bin = Bun.which("typescript-language-server");
            if (!bin) {
                throw new Error("typescript-language-server not found in PATH. Please install it with 'npm install -g typescript-language-server typescript'");
            }
            cmd = [bin, "--stdio"];
        } else if (language === 'go') {
            const bin = Bun.which("gopls");
            if (!bin) {
                throw new Error("gopls not found in PATH");
            }
            cmd = [bin];
        } else if (language === 'python') {
            const bin = Bun.which("pylsp"); // python-lsp-server
            if (!bin) {
                throw new Error("pylsp not found in PATH");
            }
            cmd = [bin];
        } else {
            throw new Error(`Language ${language} not supported yet`);
        }

        console.log(`[LSP] Spawning: ${cmd.join(' ')} in ${rootPath}`);
        const process = Bun.spawn(cmd, {
            cwd: rootPath,
            stdin: "pipe",
            stdout: "pipe",
            stderr: "pipe",
        });

        const instance: LSPInstance = {
            process: process as Subprocess<"pipe", "pipe", "pipe">,
            language,
            rootPath,
            clients: new Set(),
            buffer: ""
        };

        // Start processing stdout
        this.processOutput(instance);

        // Log stderr
        this.logStderr(instance);

        return instance;
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
                instance.buffer += chunk;
                this.processBuffer(instance);
            }
        } catch (e) {
            console.error(`[LSP] Error reading stdout for ${instance.language}`, e);
        }
    }

    private processBuffer(instance: LSPInstance) {
        while (true) {
            // Check for Content-Length header
            // Note: Use a more robust check in production, but this works for standard LSP
            const lengthMatch = instance.buffer.match(/Content-Length: (\d+)\r\n\r\n/);

            if (!lengthMatch) return; // Wait for more data

            const contentLength = parseInt(lengthMatch[1]!, 10);
            const headerSize = lengthMatch[0].length;
            const idx = lengthMatch.index || 0;

            // If we have the full message
            if (instance.buffer.length >= idx + headerSize + contentLength) {
                // Extract message
                const message = instance.buffer.slice(idx + headerSize, idx + headerSize + contentLength);

                // Remove processed part from buffer
                instance.buffer = instance.buffer.slice(idx + headerSize + contentLength);

                // Broadcast to clients
                for (const client of instance.clients) {
                    client.send(message);
                }
            } else {
                return; // Wait for more data
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
}

export const lspService = new LSPService();
