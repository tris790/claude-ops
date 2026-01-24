import { serve } from "bun";
import index from "../frontend/index.html";
import { authRoutes } from "./routes/auth";
import { repoRoutes } from "./routes/repos";
import { workItemRoutes } from "./routes/work-items";

const server = serve({
  routes: {
    // Auth Routes
    ...authRoutes,
    // Repo Routes
    ...repoRoutes,
    // Work Item Routes
    ...workItemRoutes,

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
