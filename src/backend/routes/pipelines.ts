import { azureClient } from "../services/azure";

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
    "/api/pipelines/runs/:id/cancel": {
        async POST(req: Request, params: any) {
            const { id } = params;
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
        async GET(req: Request, params: any) {
            const { id } = params;
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
        async GET(req: Request, params: any) {
            const { id, logId } = params;
            try {
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
