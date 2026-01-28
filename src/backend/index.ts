import { serve, type Server } from "bun";
import index from "../frontend/index.html";
import { authRoutes } from "./routes/auth";
import { repoRoutes } from "./routes/repos";
import { workItemRoutes } from "./routes/work-items";
import { prRoutes } from "./routes/prs";
import { pipelineRoutes } from "./routes/pipelines";
import { automationRoutes } from "./routes/automation";
import { settingsRoutes } from "./routes/settings";
import { searchRoutes } from "./routes/search";
import { lspService } from "./services/lsp";
import { gitService } from "./services/git";

import { pipelineMonitor } from "./services/pipeline-monitor";

interface WebSocketData {
  type: "lsp" | "pipelines";
  rootPath?: string;
  language?: string;
}

const server = serve<WebSocketData>({
  routes: {
    // Auth Routes
    ...authRoutes,
    // Repo Routes
    ...repoRoutes,
    // Work Item Routes
    ...workItemRoutes,
    // PR Routes
    ...prRoutes,
    // Pipeline Routes
    ...pipelineRoutes,
    // Automation Routes
    ...automationRoutes,
    // Settings Routes
    ...settingsRoutes,
    // Search Routes
    ...searchRoutes,


    "/api/hello": {
      async GET(req: Request) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
    },

    "/api/lsp": {
      async GET(req: Request, server: Server<WebSocketData>) {
        const url = new URL(req.url);
        const projectName = url.searchParams.get("project");
        const repoName = url.searchParams.get("repo");
        const language = url.searchParams.get("language");

        if (!projectName || !repoName || !language) {
          return new Response("Missing project, repo, or language", { status: 400 });
        }

        const rootPath = await gitService.getRepoPath(projectName, repoName);

        const success = server.upgrade(req, {
          data: { type: "lsp", rootPath, language }
        });

        if (success) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
      },
    },

    "/api/pipelines/ws": {
      async GET(req: Request, server: Server<WebSocketData>) {
        const success = server.upgrade(req, {
          data: { type: "pipelines" }
        });
        if (success) return undefined;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
    },

    // Serve index.html for all unmatched routes (SPA Fallback)
    "/*": index,
  },

  websocket: {
    open(ws) {
      if (ws.data.type === "lsp" && ws.data.rootPath && ws.data.language) {
        lspService.handleConnection(ws, ws.data.rootPath, ws.data.language);
      } else if (ws.data.type === "pipelines") {
        const handler = (runs: any) => {
          ws.send(JSON.stringify({ type: "update", data: runs }));
        };
        // Store the handler on the ws object or in a map to remove it later?
        // Bun's ws object is extensible? 
        // Better to just subscribe.
        // But we need to unsubscribe on close.
        (ws as any).pipelineHandler = handler;
        pipelineMonitor.addSubscriber(handler);
        console.log("[WS] Pipeline client connected");
      }
    },
    message(ws, message) {
      if (ws.data.type === "lsp" && ws.data.rootPath && ws.data.language) {
        lspService.handleMessage(ws, ws.data.rootPath, ws.data.language, message);
      }
      // Pipelines are push-only for now
    },
    close(ws) {
      if (ws.data.type === "lsp" && ws.data.rootPath && ws.data.language) {
        lspService.handleClose(ws, ws.data.rootPath, ws.data.language);
      } else if (ws.data.type === "pipelines") {
        const handler = (ws as any).pipelineHandler;
        if (handler) {
          pipelineMonitor.removeSubscriber(handler);
        }
        console.log("[WS] Pipeline client disconnected");
      }
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
