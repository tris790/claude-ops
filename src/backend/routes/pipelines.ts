import { azureClient } from "../services/azure";

function getRunId(req: Request): string {
    try {
        const url = new URL(req.url);
        const match = url.pathname.match(/\/pipelines\/runs\/(\d+)/);
        if (match && match[1]) return match[1];
    } catch (e) {
        console.error("Error parsing Run ID:", e);
    }
    return "";
}

export const pipelineRoutes = {
    "/api/pipelines": {
        async GET() {
            try {
                const pipelines = await azureClient.getPipelines();
                return Response.json(pipelines);
            } catch (error: any) {
                console.error("Error fetching pipelines:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/pipelines/runs": {
        async GET() {
            try {
                const runs = await azureClient.getRecentRuns();
                return Response.json(runs);
            } catch (error: any) {
                console.error("Error fetching pipeline runs:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
        async POST(req: Request) {
            try {
                const { pipelineId, branch } = await req.json();
                if (!pipelineId || !branch) {
                    return Response.json({ error: "Missing pipelineId or branch" }, { status: 400 });
                }
                const run = await azureClient.runPipeline(pipelineId, branch);
                return Response.json(run);
            } catch (error: any) {
                console.error("Error running pipeline:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/pipelines/:id": {
        async GET(req: Request) {
            try {
                const url = new URL(req.url);
                const segments = url.pathname.split("/");
                const id = segments[segments.length - 1]; // Correct way to get the last segment
                if (!id || id === "runs") return Response.json({ error: "Invalid pipeline ID" }, { status: 400 });
                const pipeline = await azureClient.getPipeline(parseInt(id));
                return Response.json(pipeline);
            } catch (error: any) {
                console.error("Error fetching pipeline:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/pipelines/:id/runs": {
        async GET(req: Request) {
            try {
                const url = new URL(req.url);
                const segments = url.pathname.split("/");
                const id = segments[segments.length - 2]; // Get the ID from /api/pipelines/:id/runs
                if (!id) return Response.json({ error: "Invalid pipeline ID" }, { status: 400 });
                const runs = await azureClient.getPipelineRuns(parseInt(id));
                return Response.json(runs);
            } catch (error: any) {
                console.error("Error fetching pipeline runs:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/pipelines/runs/:id": {
        async GET(req: Request) {
            const id = getRunId(req);
            if (!id) return Response.json({ error: "Invalid Run ID" }, { status: 400 });
            try {
                const run = await azureClient.getRun(parseInt(id));
                return Response.json(run);
            } catch (error: any) {
                console.error("Error fetching run details:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/pipelines/runs/:id/cancel": {
        async POST(req: Request) {
            const id = getRunId(req);
            if (!id) return Response.json({ error: "Invalid Run ID" }, { status: 400 });
            try {
                const result = await azureClient.cancelRun(parseInt(id));
                return Response.json(result);
            } catch (error: any) {
                console.error("Error cancelling run:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/pipelines/runs/:id/timeline": {
        async GET(req: Request) {
            const id = getRunId(req);
            if (!id) return Response.json({ error: "Invalid Run ID" }, { status: 400 });
            try {
                const timeline = await azureClient.getRunTimeline(parseInt(id));
                return Response.json(timeline);
            } catch (error: any) {
                console.error("Error fetching timeline:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    },
    "/api/pipelines/runs/:id/logs/:logId": {
        async GET(req: Request) {
            const id = getRunId(req);
            if (!id) return Response.json({ error: "Invalid Run ID" }, { status: 400 });

            try {
                const url = new URL(req.url);
                const logId = url.pathname.split("/").pop(); // Get last segment
                if (!logId) throw new Error("Missing logId");

                const logs = await azureClient.getLogContent(parseInt(id), parseInt(logId));
                return new Response(logs, {
                    headers: { "Content-Type": "text/plain" }
                });
            } catch (error: any) {
                console.error("Error fetching logs:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    }
};
