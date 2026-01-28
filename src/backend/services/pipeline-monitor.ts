import { EventEmitter } from "events";
import { azureClient } from "./azure";

class PipelineMonitor extends EventEmitter {
    private interval: NodeJS.Timeout | null = null;
    private isRunning = false;
    private readonly POLL_INTERVAL = 10000; // 10 seconds
    private subscribers = 0;

    addSubscriber(handler: (data: any) => void) {
        this.on("updated", handler);
        this.subscribers++;
        if (this.subscribers === 1) {
            this.start();
        }
    }

    removeSubscriber(handler: (data: any) => void) {
        this.off("updated", handler);
        this.subscribers--;
        if (this.subscribers <= 0) {
            this.subscribers = 0;
            this.stop();
        }
    }

    private start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("[PipelineMonitor] Starting service (active subscribers)...");

        // Initial fetch
        this.checkPipelines();

        this.interval = setInterval(() => {
            this.checkPipelines();
        }, this.POLL_INTERVAL);
    }

    private stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        console.log("[PipelineMonitor] Stopped service (no subscribers)");
    }

    private async checkPipelines() {
        if (!this.isRunning) return;
        try {
            // We fetch the latest run for every pipeline. 
            // This is efficient enough (1 request per project) and covers all state changes.
            const runs = await azureClient.getRecentRuns();

            // Emit the full list. The frontend can merge it.
            // In a more optimized version, we would diff and only send updates,
            // but for "true eventing" feel, sending the latest state is acceptable for now.
            if (runs.length > 0) {
                // console.log(`[PipelineMonitor] Broadcasting ${runs.length} runs. Latest ID: ${runs[0]?.id}`);
            }
            this.emit("updated", runs);
        } catch (error) {
            console.error("[PipelineMonitor] Error checking pipelines:", error);
        }
    }
}

export const pipelineMonitor = new PipelineMonitor();
