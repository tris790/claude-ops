import React, { useState, useEffect } from "react";
import { X, Loader2, Play, GitBranch, AlertCircle } from "lucide-react";
import { getPipeline, runPipeline } from "../../api/pipelines";
import { getBranches } from "../../api/repos";
import { MultiSelect } from "../ui/MultiSelect";

interface QueuePipelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    pipeline: any;
    onQueued: (run?: any) => void;
}

export function QueuePipelineModal({ isOpen, onClose, pipeline, onQueued }: QueuePipelineModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetchingBranches, setFetchingBranches] = useState(false);
    const [branches, setBranches] = useState<{ label: string; value: string }[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && pipeline) {
            fetchPipelineAndBranches();
        } else {
            // Reset state when closing
            setSelectedBranch("");
            setError(null);
            setBranches([]);
        }
    }, [isOpen, pipeline]);

    async function fetchPipelineAndBranches() {
        setFetchingBranches(true);
        setError(null);
        try {
            const details = await getPipeline(pipeline.id);
            const repoId = details.configuration?.repository?.id;

            if (!repoId) {
                // Try to fallback if it's an old style pipeline or something else
                // For now, if no repoId we can't fetch branches easily
                throw new Error("Could not determine repository for this pipeline");
            }

            const branchData = await getBranches(repoId);
            const formattedBranches = branchData.map(b => ({
                label: b.name,
                value: b.name
            }));
            setBranches(formattedBranches);

            // Try to set default branch
            const defaultBranch = details.configuration?.repository?.defaultBranch || "main";
            setSelectedBranch(defaultBranch.replace("refs/heads/", ""));
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to fetch branches");
        } finally {
            setFetchingBranches(false);
        }
    }

    async function handleQueue() {
        if (!selectedBranch) return;

        setLoading(true);
        setError(null);

        try {
            const run = await runPipeline(pipeline.id, selectedBranch);
            console.log("[QueuePipelineModal] Raw queued run:", run);

            // Normalize Pipeline API response to match Build API shape expected by UI
            const normalizedRun = {
                ...run,
                definition: run.definition || run.pipeline || { id: pipeline.id, name: pipeline.name },
                status: run.status || run.state,
                queueTime: run.queueTime || run.createdDate || new Date().toISOString(),
                // Ensure sourceBranch is present
                sourceBranch: run.sourceBranch || selectedBranch,
                // Ensure project is present if missing (generic fallback)
                project: run.project || { name: "Unknown" }
            };

            onQueued(normalizedRun);
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to queue pipeline");
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-white/80 dark:bg-zinc-950/80 z-[60] backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
                <div
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-500">
                                <Play className="h-4 w-4 fill-current" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Run Pipeline</h3>
                                <p className="text-xs text-zinc-500 truncate max-w-[250px]">{pipeline.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors p-1"
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 min-h-[300px] flex flex-col justify-between">
                        <div className="space-y-6">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-400 flex items-center gap-2">
                                    <GitBranch className="h-3.5 w-3.5" />
                                    Branch
                                </label>
                                {fetchingBranches ? (
                                    <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-800/50 animate-pulse rounded-md border border-zinc-200 dark:border-zinc-800" />
                                ) : (
                                    <MultiSelect
                                        multiple={false}
                                        options={branches}
                                        selected={selectedBranch}
                                        onChange={(val) => setSelectedBranch(val)}
                                        placeholder="Select a branch..."
                                        className="w-full"
                                    />
                                )}
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-600">The branch to use for this run.</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800/50 mt-auto">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleQueue}
                                disabled={loading || !selectedBranch || fetchingBranches}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Play className="h-4 w-4 fill-current" />
                                )}
                                Run pipeline
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
