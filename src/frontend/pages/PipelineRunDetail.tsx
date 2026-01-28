import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRun, getRunTimeline, getLogContent } from "../api/pipelines";
import {
    ArrowLeft,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Terminal,
    ChevronRight,
    Play,
    GitBranch,
    User
} from "lucide-react";

export function PipelineRunDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [run, setRun] = useState<any>(null);
    const [timeline, setTimeline] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [logs, setLogs] = useState<string>("");
    const [loadingLogs, setLoadingLogs] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    async function loadData(silent = false) {
        if (!silent) setLoading(true);
        try {
            const [runData, timelineData] = await Promise.all([
                getRun(parseInt(id!)),
                getRunTimeline(parseInt(id!))
            ]);
            setRun(runData);
            setTimeline(timelineData);
            // Select first job by default if none selected
            if (!selectedRecordId) {
                const firstJob = timelineData.records.find((r: any) => r.type === "Job");
                if (firstJob) setSelectedRecordId(firstJob.id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    useEffect(() => {
        if (selectedRecordId && timeline) {
            const record = timeline.records.find((r: any) => r.id === selectedRecordId);
            if (record && record.log) {
                loadLogs(record.log.id);
            } else {
                setLogs("No logs available for this step.");
            }
        }
    }, [selectedRecordId, timeline]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    async function loadLogs(logId: number) {
        setLoadingLogs(true);
        try {
            const content = await getLogContent(parseInt(id!), logId);
            setLogs(content);
        } catch (err) {
            setLogs("Failed to load logs.");
        } finally {
            setLoadingLogs(false);
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
    );

    if (!timeline) return <div className="text-zinc-500">Run detail not found.</div>;

    const records = timeline.records || [];
    const jobs = records.filter((r: any) => r.type === "Job");

    return (
        <div className="flex flex-col h-full space-y-4 w-full px-4">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/pipelines")}
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                Run #{id}
                            </h1>
                            {run && (
                                <div className="flex items-center gap-2 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                                    <span>{run.project?.name}</span>
                                    <span>•</span>
                                    <span>{run.definition?.name}</span>
                                </div>
                            )}
                        </div>
                        {run && (
                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                    <GitBranch className="h-3 w-3" />
                                    {run.sourceBranch?.split('/').pop()}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {run.requestedFor?.displayName}
                                </span>
                                <span>•</span>
                                <span>{new Date(run.queueTime).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex flex-1 gap-4 min-h-0">
                <div className="w-64 flex-shrink-0 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Jobs & Steps</h3>
                    </div>
                    <div className="flex-1 overflow-auto py-2">
                        {jobs.map((job: any) => (
                            <div key={job.id} className="space-y-1">
                                <button
                                    onClick={() => setSelectedRecordId(job.id)}
                                    className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${selectedRecordId === job.id ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5'}`}
                                >
                                    <StatusSmallIcon status={job.result || job.state} />
                                    <span className="text-sm font-medium truncate">{job.name}</span>
                                </button>
                                {/* Show steps under the job */}
                                {records.filter((r: any) => r.parentId === job.id).map((step: any) => (
                                    <button
                                        key={step.id}
                                        onClick={() => setSelectedRecordId(step.id)}
                                        className={`w-full pl-10 pr-4 py-1.5 flex items-center gap-3 text-left transition-colors ${selectedRecordId === step.id ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/5'}`}
                                    >
                                        <StatusSmallIcon status={step.result || step.state} />
                                        <span className="text-xs truncate">{step.name}</span>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-mono">
                            <Terminal className="h-3 w-3" />
                            <span>Logs</span>
                        </div>
                        {loadingLogs && <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />}
                    </div>
                    <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
                        <pre className="text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap break-all">
                            {logs}
                        </pre>
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusSmallIcon({ status }: { status?: string }) {
    switch (status) {
        case "succeeded":
            return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
        case "failed":
            return <XCircle className="h-3.5 w-3.5 text-red-500" />;
        case "inProgress":
            return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
        default:
            return <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 ml-1 mr-1" />;
    }
}
