import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPipelines, getRecentRuns, runPipeline, cancelRun } from "../api/pipelines";
import { usePolling } from "../hooks/usePolling";
import {
    Play,
    StopCircle,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Search,
    RefreshCw,
    GitBranch,
    User
} from "lucide-react";

export function PipelineList() {
    const navigate = useNavigate();
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    usePolling(async () => {
        await loadData(true);
    }, {
        enabled: true,
        activeInterval: 5000,
        backgroundInterval: 30000,
    });

    async function loadData(silent = false) {
        if (!silent) setLoading(true);
        try {
            const [pipelineData, runData] = await Promise.all([
                getPipelines(),
                getRecentRuns()
            ]);
            setPipelines(pipelineData);
            setRuns(runData);
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    async function handleRun(pipelineId: number) {
        // For Phase 1, we'll prompt for branch or just use "main"
        const branch = prompt("Enter branch name to run:", "main");
        if (!branch) return;

        setIsRunning(true);
        try {
            await runPipeline(pipelineId, branch);
            loadData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsRunning(false);
        }
    }

    async function handleCancel(runId: number) {
        try {
            await cancelRun(runId);
            loadData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    const filteredPipelines = pipelines.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Pipelines</h1>
                    <p className="text-zinc-500 text-sm mt-1">Monitor and trigger CI/CD workflows.</p>
                </div>
                <button
                    onClick={() => loadData()}
                    className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                    <RefreshCw className="h-5 w-5" />
                </button>
            </header>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Search pipelines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-200 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                />
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredPipelines.map((pipeline) => {
                    const latestRun = runs.find(r => r.definition.id === pipeline.id);
                    return (
                        <div key={pipeline.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-all">
                            <div className="flex items-center gap-4 min-w-0">
                                <StatusIcon status={latestRun?.result || latestRun?.status} />
                                <div className="min-w-0">
                                    <h3
                                        className={`text-sm font-semibold truncate ${latestRun ? 'cursor-pointer hover:text-blue-400' : 'text-zinc-200'}`}
                                        onClick={() => latestRun && navigate(`/pipelines/${latestRun.id}`)}
                                    >
                                        {pipeline.name}
                                    </h3>
                                    {latestRun ? (
                                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                            <span className="flex items-center gap-1">
                                                <GitBranch className="h-3 w-3 text-zinc-600" />
                                                {latestRun.sourceBranch.split('/').pop()}
                                            </span>
                                            <span>•</span>
                                            <span>{latestRun.status}</span>
                                            <span>•</span>
                                            <span>{new Date(latestRun.queueTime).toLocaleString()}</span>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-zinc-600 mt-1 italic">No recent runs</div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {latestRun?.status === "inProgress" && (
                                    <button
                                        onClick={() => handleCancel(latestRun.id)}
                                        className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                                        title="Cancel Run"
                                    >
                                        <StopCircle className="h-5 w-5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleRun(pipeline.id)}
                                    disabled={isRunning}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md text-xs font-medium transition-all"
                                >
                                    <Play className="h-3 w-3" />
                                    Run
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredPipelines.length === 0 && (
                    <div className="p-12 text-center text-zinc-500 border border-zinc-800 border-dashed rounded-xl">
                        No pipelines found.
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusIcon({ status }: { status?: string }) {
    switch (status) {
        case "succeeded":
            return <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500"><CheckCircle2 className="h-5 w-5" /></div>;
        case "failed":
            return <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500"><XCircle className="h-5 w-5" /></div>;
        case "inProgress":
        case "cancelling":
            return <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 animate-pulse"><Clock className="h-5 w-5" /></div>;
        default:
            return <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500"><Clock className="h-5 w-5" /></div>;
    }
}
