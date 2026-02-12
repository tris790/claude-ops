import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { VariableSizeList } from "react-window";
import { getPipelines, getRecentRuns, cancelRun, getPipelineRuns } from "../api/pipelines";
import {
    Play,
    StopCircle,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    RefreshCw,
    GitBranch,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Terminal
} from "lucide-react";
import { QueuePipelineModal } from "../components/pipeline/QueuePipelineModal";
import { useRepoContext } from "../contexts/RepoContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";

const ROW_HEIGHT = 56;
const EXPANDED_HEIGHT = 450;

function useWindowDimensions() {
    const [dimensions, setDimensions] = useState({
        width: typeof window !== "undefined" ? window.innerWidth : 1200,
        height: typeof window !== "undefined" ? window.innerHeight : 800,
    });

    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return dimensions;
}

const PipelineRow = React.memo(({ index, style, data }: { index: number, style: React.CSSProperties, data?: any }) => {
    const {
        pipelines,
        latestRuns,
        expandedPipelines,
        runs,
        toggleExpand,
        handleRun,
        handleCancel,
        navigate
    } = data;

    const pipeline = pipelines[index];
    if (!pipeline) return null;

    const latestRun = latestRuns[pipeline.id];
    const isExpanded = expandedPipelines.has(pipeline.id);
    const history = runs[pipeline.id] || [];

    const getStatusColor = (status?: string) => {
        switch (status) {
            case "succeeded": return "success";
            case "failed": return "destructive";
            case "inProgress":
            case "cancelling": return "default";
            default: return "secondary";
        }
    };

    return (
        <div style={style} className="px-6 py-1">
            <div
                className={`h-full bg-white dark:bg-zinc-900 border ${isExpanded ? 'border-zinc-300 dark:border-zinc-700 ring-1 ring-sapphire-600/30' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'} rounded-lg transition-all flex flex-col overflow-hidden cursor-pointer`}
                onClick={() => toggleExpand(pipeline.id)}
            >
                <div className="flex items-center justify-between px-4 h-[46px] shrink-0">
                    <div className="flex items-center gap-4 min-w-0">
                        <StatusIcon status={latestRun?.result || latestRun?.status} size="sm" />
                        <div className="flex items-baseline gap-3 min-w-0">
                            <h3
                                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:text-sapphire-500 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    latestRun && navigate(`/pipelines/${latestRun.id}`);
                                }}
                            >
                                {pipeline.name}
                            </h3>
                            {latestRun && (
                                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                    <span className="flex items-center gap-1">
                                        <GitBranch className="h-3 w-3" />
                                        {latestRun.sourceBranch ? latestRun.sourceBranch.split('/').pop() : 'unknown'}
                                    </span>
                                    <span>•</span>
                                    <span className="capitalize">{latestRun.status}</span>
                                    <span>•</span>
                                    <span>{new Date(latestRun.queueTime).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {latestRun?.status === "inProgress" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancel(latestRun.id);
                                }}
                                className="text-zinc-500 hover:text-red-500 p-1 h-8 w-8"
                                title="Cancel Run"
                            >
                                <StopCircle className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRun(pipeline);
                            }}
                            className="h-8 gap-2 text-xs"
                        >
                            <Play className="h-3 w-3" />
                            Run
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(pipeline.id);
                            }}
                            className={`p-1 h-8 w-8 ${isExpanded ? 'text-sapphire-500' : 'text-zinc-500'}`}
                        >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-200 dark:border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/50 bg-zinc-100/50 dark:bg-zinc-900/30">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Recent Runs</span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">{history.length} runs</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {history.length > 0 ? (
                                history.map((run: any) => (
                                    <div
                                        key={run.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/pipelines/${run.id}`);
                                        }}
                                        className="px-4 py-2.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/20 hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <StatusIcon status={run.result || run.status} size="xs" />
                                            <div>
                                                <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">#{run.id}</div>
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                                    <span>{run.name}</span>
                                                    <span>•</span>
                                                    <span>{new Date(run.queueTime).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant={getStatusColor(run.result || run.status)}>
                                            {run.result || run.status}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center">
                                    <Spinner size="sm" className="mx-auto mb-2 opacity-50" />
                                    <p className="text-[11px] text-zinc-600 uppercase tracking-widest">Loading history...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

PipelineRow.displayName = "PipelineRow";

export function PipelineList() {
    const { clearContext } = useRepoContext();
    const navigate = useNavigate();

    // Clear repo context when on pipelines page
    useEffect(() => {
        clearContext();
    }, [clearContext]);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<VariableSizeList>(null);
    const { height: windowHeight } = useWindowDimensions();

    const [pipelines, setPipelines] = useState<any[]>([]);
    const [runs, setRuns] = useState<Record<number, any[]>>({});
    const [latestRuns, setLatestRuns] = useState<Record<number, any>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedPipelines, setExpandedPipelines] = useState<Set<number>>(new Set());
    const [selectedPipeline, setSelectedPipeline] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Container sizing
    const [listSize, setListSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (containerRef.current) {
            setListSize({
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight
            });
        }
    }, [windowHeight, loading, pipelines.length]);

    // Helper to merge new runs into existing state, preventing stale data overwrites
    // This updates BOTH the latestRuns (header) and runs (expanded history)
    const syncRun = useCallback((run: any) => {
        if (!run || !run.definition) return;
        const defId = run.definition.id;

        // 1. Update Latest Runs (Header)
        setLatestRuns((prev: any) => {
            const existing = prev[defId];
            if (!existing || run.id >= existing.id) {
                return { ...prev, [defId]: run };
            }
            return prev;
        });

        // 2. Update Runs History (Expanded List)
        // Only if we have history loaded for this pipeline
        setRuns((prev: any) => {
            if (!prev[defId]) return prev; // History not loaded yet, don't create it
            // if we are here it means we expanded the row at least once

            const currentHistory = prev[defId];
            // Check if run already exists in history
            const exists = currentHistory.find((r: any) => r.id === run.id);

            let newHistory;
            if (exists) {
                // Update existing item
                newHistory = currentHistory.map((r: any) => r.id === run.id ? run : r);
            } else {
                // Prepend new item
                newHistory = [run, ...currentHistory];
            }

            // Sort just in case
            newHistory.sort((a: any, b: any) => new Date(b.queueTime).getTime() - new Date(a.queueTime).getTime());

            return { ...prev, [defId]: newHistory };
        });
    }, []);

    useEffect(() => {
        // WebSocket for live updates
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${proto}//${window.location.host}/api/pipelines/ws`;
        let ws: WebSocket | null = null;
        let retryInterval: any = null;
        let isMounted = true;

        function connect() {
            if (!isMounted) return;

            // Use the globally available WebSocket constructor
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                if (isMounted) console.log("[PipelineList] Connected to event stream");
            };

            ws.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === "update") {
                        const runs = msg.data;
                        // console.log(`[PipelineList] WS received ${runs.length} runs`);
                        runs.forEach((run: any) => syncRun(run));
                    }
                } catch (e) {
                    console.error("[PipelineList] WS Error:", e);
                }
            };

            ws.onclose = () => {
                if (!isMounted) return;
                console.log("[PipelineList] Disconnected, retrying...");
                retryInterval = setTimeout(connect, 3000);
            };
        }

        connect();

        return () => {
            isMounted = false;
            if (ws) {
                // Remove listener to ensure no 'onclose' triggers during intentional close
                ws.onclose = null;
                ws.close();
            }
            if (retryInterval) clearTimeout(retryInterval);
        };
    }, [syncRun]);


    async function loadData(silent = false) {
        if (!silent) setLoading(true);
        try {
            const [pipelineData, runData] = await Promise.all([
                getPipelines(),
                getRecentRuns()
            ]);
            setPipelines(pipelineData);

            const latest: Record<number, any> = {};
            runData.forEach((run: any) => {
                latest[run.definition.id] = run;
            });
            setLatestRuns(latest);
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    const filteredPipelines = useMemo(() =>
        pipelines.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [pipelines, searchTerm]
    );

    const toggleExpand = useCallback(async (pipelineId: number) => {
        setExpandedPipelines(prev => {
            const next = new Set(prev);
            if (next.has(pipelineId)) {
                next.delete(pipelineId);
            } else {
                next.add(pipelineId);
                if (!runs[pipelineId]) {
                    getPipelineRuns(pipelineId).then(pipelineRuns => {
                        setRuns(r => ({ ...r, [pipelineId]: pipelineRuns }));
                    }).catch(err => console.error(err));
                }
            }
            return next;
        });

        setTimeout(() => {
            if (listRef.current) {
                listRef.current.resetAfterIndex(0);
            }
        }, 0);
    }, [runs]);

    const getItemSize = useCallback((index: number) => {
        const pipeline = filteredPipelines[index];
        if (!pipeline) return ROW_HEIGHT;
        return expandedPipelines.has(pipeline.id) ? EXPANDED_HEIGHT : ROW_HEIGHT;
    }, [filteredPipelines, expandedPipelines]);

    const handleRun = useCallback((pipeline: any) => {
        setSelectedPipeline(pipeline);
        setIsModalOpen(true);
    }, []);

    const handleCancel = useCallback(async (runId: number) => {
        try {
            await cancelRun(runId);
            loadData(true);
        } catch (err: any) {
            alert(err.message);
        }
    }, []);

    const itemData = useMemo(() => ({
        pipelines: filteredPipelines,
        latestRuns,
        expandedPipelines,
        runs,
        toggleExpand,
        handleRun,
        handleCancel,
        navigate
    }), [filteredPipelines, latestRuns, expandedPipelines, runs, toggleExpand, handleRun, handleCancel, navigate]);

    if (loading && pipelines.length === 0) return (
        <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950">
            <Spinner />
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
            <div className="flex-none max-w-7xl w-full mx-auto px-6 py-6 border-b border-zinc-200 dark:border-zinc-800/50">
                <header className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Pipelines</h1>
                        <p className="text-zinc-500 text-sm mt-1">Monitor and trigger CI/CD workflows.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-mono">
                            {filteredPipelines.length} total
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadData()}
                            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </header>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    <Input
                        placeholder="Search pipelines..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-white dark:bg-zinc-950"
                    />
                </div>
            </div>

            <div className="flex-1 min-h-0 relative" ref={containerRef}>
                {filteredPipelines.length > 0 ? (
                    <VariableSizeList
                        ref={listRef}
                        height={listSize.height}
                        width={listSize.width}
                        itemCount={filteredPipelines.length}
                        itemSize={getItemSize}
                        itemData={itemData}
                        className="scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
                        overscanCount={10}
                    >
                        {PipelineRow}
                    </VariableSizeList>
                ) : !loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-950/20">
                        <Terminal className="h-10 w-10 mb-4 opacity-10" />
                        <p className="text-sm font-medium">No pipelines found.</p>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="mt-2 text-xs text-sapphire-500 hover:underline"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                )}
            </div>

            {selectedPipeline && (
                <QueuePipelineModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedPipeline(null);
                    }}
                    pipeline={selectedPipeline}
                    onQueued={(newRun) => {
                        if (newRun && newRun.definition) {
                            // Optimistically update
                            syncRun(newRun);
                        }
                    }}
                />
            )}
        </div>
    );
}

function StatusIcon({ status, size = "md" }: { status?: string, size?: "xs" | "sm" | "md" }) {
    const dimensions = {
        xs: "h-5 w-5",
        sm: "h-8 w-8",
        md: "h-10 w-10"
    };
    const iconSizes = {
        xs: "h-3 w-3",
        sm: "h-4 w-4",
        md: "h-5 w-5"
    };

    const d = dimensions[size];
    const i = iconSizes[size];

    switch (status) {
        case "succeeded":
            return <div className={`${d} rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-500/20`}><CheckCircle2 className={i} /></div>;
        case "failed":
            return <div className={`${d} rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-500 border border-red-200 dark:border-red-500/20`}><XCircle className={i} /></div>;
        case "inProgress":
        case "cancelling":
            return <div className={`${d} rounded-full bg-sapphire-100 dark:bg-sapphire-600/10 flex items-center justify-center text-sapphire-600 dark:text-sapphire-500 animate-pulse border border-sapphire-200 dark:border-sapphire-600/20`}><Clock className={i} /></div>;
        default:
            return <div className={`${d} rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-200 dark:border-zinc-700`}><Clock className={i} /></div>;
    }
}
