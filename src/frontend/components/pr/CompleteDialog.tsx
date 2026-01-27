import React, { useState } from "react";
import { X, Loader2, GitMerge, Trash2, CheckSquare } from "lucide-react";
import { updatePullRequest } from "../../api/prs";
import { MultiSelect } from "../ui/MultiSelect";

interface CompleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    pr: any;
    onComplete: () => void;
}

export function CompleteDialog({ isOpen, onClose, pr, onComplete }: CompleteDialogProps) {
    const [loading, setLoading] = useState(false);
    const [deleteSourceBranch, setDeleteSourceBranch] = useState(true);
    const [completeWorkItems, setCompleteWorkItems] = useState(true);
    const [mergeStrategy, setMergeStrategy] = useState("squash");
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    async function handleComplete() {
        setLoading(true);
        setError(null);

        try {
            await updatePullRequest(pr.pullRequestId, pr.repository.id, {
                status: "completed",
                lastMergeSourceCommit: pr.lastMergeSourceCommit,
                completionOptions: {
                    deleteSourceBranch,
                    squashMerge: mergeStrategy === "squash",
                    mergeCommitMessage: pr.title,
                    transitionWorkItems: completeWorkItems
                }
            });
            onComplete();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to complete PR");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                        <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                            <GitMerge className="h-5 w-5 text-blue-500" />
                            Complete Pull Request
                        </h3>
                        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors ${deleteSourceBranch ? "bg-blue-600 border-blue-600" : "border-zinc-700 bg-zinc-800 group-hover:border-zinc-500"}`}>
                                    {deleteSourceBranch && <CheckSquare className="h-3.5 w-3.5 text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={deleteSourceBranch}
                                    onChange={(e) => setDeleteSourceBranch(e.target.checked)}
                                />
                                <div>
                                    <div className="text-sm font-medium text-zinc-200">Delete {pr.sourceRefName.replace('refs/heads/', '')}</div>
                                    <div className="text-xs text-zinc-500">Delete the source branch after merging</div>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors ${completeWorkItems ? "bg-blue-600 border-blue-600" : "border-zinc-700 bg-zinc-800 group-hover:border-zinc-500"}`}>
                                    {completeWorkItems && <CheckSquare className="h-3.5 w-3.5 text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={completeWorkItems}
                                    onChange={(e) => setCompleteWorkItems(e.target.checked)}
                                />
                                <div>
                                    <div className="text-sm font-medium text-zinc-200">Complete linked work items</div>
                                    <div className="text-xs text-zinc-500">Transition any linked work items to Closed/Done</div>
                                </div>
                            </label>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-400">Merge Strategy</label>
                                <MultiSelect
                                    multiple={false}
                                    options={[
                                        { label: "Squash commit", value: "squash" },
                                        { label: "Merge (no fast-forward)", value: "merge" },
                                        { label: "Rebase and fast-forward", value: "rebase" },
                                        { label: "Rebase with merge commit", value: "rebaseMerge" }
                                    ]}
                                    selected={mergeStrategy}
                                    onChange={(val) => setMergeStrategy(val)}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Complete merge
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
