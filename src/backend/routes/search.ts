import { searchService } from "../services/search";
import type { Server } from "bun";

export const searchRoutes = {
    "/api/search": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const query = url.searchParams.get("q");

            if (!query) {
                return Response.json([]);
            }

            try {
                const generator = searchService.searchGlobalStream(query);
                const encoder = new TextEncoder();

                const stream = new ReadableStream({
                    async start(controller) {
                        try {
                            for await (const result of generator) {
                                controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
                            }
                        } catch (e) {
                            console.error("Stream error", e);
                            controller.error(e);
                        } finally {
                            controller.close();
                        }
                    }
                });

                return new Response(stream, {
                    headers: {
                        "Content-Type": "application/x-ndjson",
                        "X-Content-Type-Options": "nosniff"
                    }
                });
            } catch (e) {
                console.error("Search API error:", e);
                return new Response("Search failed", { status: 500 });
            }
        },
    },
};
