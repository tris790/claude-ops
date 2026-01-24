import { serve } from "bun";
import index from "../frontend/index.html";
import { authRoutes } from "./routes/auth";
import { repoRoutes } from "./routes/repos";
import { workItemRoutes } from "./routes/work-items";
import { prRoutes } from "./routes/prs";
import { pipelineRoutes } from "./routes/pipelines";

const server = serve({
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
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
    },

    // Serve index.html for all unmatched routes (SPA Fallback)
    "/*": index,
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

