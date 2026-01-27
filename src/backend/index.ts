import { serve, type Server } from "bun";
import index from "../frontend/index.html";
import { authRoutes } from "./routes/auth";
import { repoRoutes } from "./routes/repos";
import { workItemRoutes } from "./routes/work-items";
import { prRoutes } from "./routes/prs";
import { pipelineRoutes } from "./routes/pipelines";
import { automationRoutes } from "./routes/automation";
import { lspService } from "./services/lsp";
import { gitService } from "./services/git";

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
    // Automation Routes
    ...automationRoutes,


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

        // Resolve absolute path using GitService
        // We need to import gitService at the top of file or use it here
        // Since it's imported later in the file, we might need to move the import up
        // But for now let's assume we can move it or it's hoisted. 
        // Actually, let's fix the import in a separate step or assume it is available. 
        // The previous view_file showed it at line 86. 
        // I will rely on moving the import if needed, but for now I will just reference it.
        // Wait, if it's let/const it's not hoisted. It was `import ...` which are hoisted.
        // But it was imported mid-file? No, top-level imports are usually at top.
        // The previous view_file showed it at line 86. That's weird for a standard file.
        // Ah, line 86: `import { gitService } from "./services/git";` 
        // This is valid ES module syntax but usually discouraged.

        const rootPath = gitService.getRepoPath(projectName, repoName);

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

