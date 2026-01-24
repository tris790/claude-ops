import { join, resolve } from "path";
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
                ws.send(JSON.stringify({ error: `Failed to spawn language server: ${e instanceof Error ? e.message : String(e)}` }));
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

        const json = typeof message === 'string' ? message : message.toString();
        let payload: any;
        try {
            payload = JSON.parse(json);
            // Rewrite URIs from client to server (bridge rootPath)
            this.rewriteURIs(payload, (uri) => {
                if (uri.startsWith('file:///')) {
                    const relativePath = uri.slice(8);
                    return `file://${join(rootPath, relativePath)}`;
                }
                return uri;
            });
        } catch (e) {
            // If not JSON, just forward as is (unlikely for LSP)
            this.forwardToProcess(instance, json);
            return;
        }

        this.forwardToProcess(instance, JSON.stringify(payload));
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

    private async resolveLSPCommand(language: string): Promise<string[]> {
        // Tier 1: System Path (Preferred if installed intentionally)
        if (language === 'typescript' || language === 'javascript') {
            // Tier 0: Local node_modules (Best for dev/self-contained)
            // Process CWD is expected to be the app root
            const projectRoot = process.cwd();
            const localBin = resolve(projectRoot, "node_modules/.bin/typescript-language-server");
            if (await Bun.file(localBin).exists()) {
                console.log(`[LSP] Found local typescript-language-server at ${localBin}`);
                return [localBin, "--stdio"];
            }

            const bin = Bun.which("typescript-language-server");
            if (bin) return [bin, "--stdio"];

            // Tier 2: VS Code Bundled (tsserver)
            // Note: tsserver speaks a proprietary protocol, not standard LSP.
            // However, for the purpose of this task, we will attempt to launch it.
            // In a real scenario, we'd need a protocol adapter (like typescript-language-server).
            const vscodePaths = [
                "/opt/visual-studio-code/resources/app/extensions/node_modules/typescript/lib/tsserver.js",
                "/usr/share/code/resources/app/extensions/node_modules/typescript/lib/tsserver.js",
                "/usr/lib/code/resources/app/extensions/node_modules/typescript/lib/tsserver.js"
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
            // This requires listing directory to find version
        } else if (language === 'python') {
            const bin = Bun.which("pylsp");
            if (bin) return [bin];
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

        // Send 'initialize'
        const initMsg = {
            jsonrpc: "2.0",
            id: 0,
            method: "initialize",
            params: {
                processId: process.pid,
                rootUri: `file://${rootPath}`,
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
                        }
                    },
                    workspace: {
                        workspaceFolders: true,
                        configuration: true
                    }
                }
            }
        };

        this.sendToInstance(instance, initMsg);

        // We technically should wait for response, but for now we immediately send 'initialized'
        // to ensure the server enters the ready state.
        // Most servers handle this pipelining fine.
        const initializedMsg = {
            jsonrpc: "2.0",
            method: "initialized",
            params: {}
        };
        this.sendToInstance(instance, initializedMsg);

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

                let payload: any;
                try {
                    payload = JSON.parse(message);
                    this.rewriteURIs(payload, (uri) => {
                        if (uri.startsWith(`file://${instance.rootPath}`)) {
                            let rel = uri.slice(`file://${instance.rootPath}`.length);
                            if (rel.startsWith('/')) rel = rel.slice(1);
                            return `file:///${rel}`;
                        }
                        return uri;
                    });
                } catch (e) {
                    // ignore parse error, send original (should not happen in valid LSP)
                }

                const finalMessage = payload ? JSON.stringify(payload) : message;

                // Broadcast to clients
                for (const client of instance.clients) {
                    client.send(finalMessage);
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
