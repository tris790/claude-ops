import { serve, type Server } from "bun";
import index from "../frontend/index.html";
import { authRoutes } from "./routes/auth";
import { repoRoutes } from "./routes/repos";
import { workItemRoutes } from "./routes/work-items";
import { prRoutes } from "./routes/prs";
import { pipelineRoutes } from "./routes/pipelines";
import { lspService } from "./services/lsp";

interface WebSocketData {
  rootPath: string;
  language: string;
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
        const rootPath = url.searchParams.get("rootPath");
        const language = url.searchParams.get("language");

        if (!rootPath || !language) {
          return new Response("Missing rootPath or language", { status: 400 });
        }

        const success = server.upgrade(req, {
          data: { rootPath, language }
        });

        if (success) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
      },
    },

    // Serve index.html for all unmatched routes (SPA Fallback)
    "/*": index,
  },

  websocket: {
    open(ws) {
      lspService.handleConnection(ws, ws.data.rootPath, ws.data.language);
    },
    message(ws, message) {
      lspService.handleMessage(ws, ws.data.rootPath, ws.data.language, message);
    },
    close(ws) {
      lspService.handleClose(ws, ws.data.rootPath, ws.data.language);
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

// Background Fetch Loop (Every 5 minutes)
import { gitService } from "./services/git";

setInterval(async () => {
  // Silent in production, maybe log in dev
  if (process.env.NODE_ENV !== 'production') {
    console.log("[Background] Starting git fetch...");
  }
  try {
    await gitService.fetchAll();
  } catch (e) {
    console.error("[Background] Git fetch failed", e);
  }
}, 5 * 60 * 1000); // 5 minutes

