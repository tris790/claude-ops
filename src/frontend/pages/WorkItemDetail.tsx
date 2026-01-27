import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getWorkItemDetails, updateWorkItem, addWorkItemComment } from "../api/work-items";
import {
    ArrowLeft,
    User,
    Clock,
    MessageSquare,
    Send,
    Loader2
} from "lucide-react";
import { MultiSelect } from "../components/ui/MultiSelect";

export function WorkItemDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [comment, setComment] = useState("");

    useEffect(() => {
        if (id) loadItem(parseInt(id));
    }, [id]);

    async function loadItem(wiId: number) {
        setLoading(true);
        try {
            const data = await getWorkItemDetails(wiId);
            setItem(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdateState(newState: string) {
        if (!id || !item) return;
        setSaving(true);
        try {
            const updated = await updateWorkItem(parseInt(id), { "System.State": newState });
            setItem(updated);
        } catch (err) {
            alert("Failed to update state");
        } finally {
            setSaving(false);
        }
    }

    async function handleAddComment(e: React.FormEvent) {
        e.preventDefault();
        if (!id || !comment.trim()) return;
        try {
            await addWorkItemComment(parseInt(id), comment);
            setComment("");
            // Simple reload for now
            loadItem(parseInt(id));
        } catch (err) {
            alert("Failed to add comment");
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
    );

    if (!item) return <div className="text-zinc-500">Work item not found.</div>;

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            <button
                onClick={() => navigate("/workitems")}
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to list
            </button>

            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <span className="text-zinc-500 font-mono text-lg">#{item.id}</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {item.fields["System.WorkItemType"]}
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-zinc-100 leading-tight">
                    {item.fields["System.Title"]}
                </h1>

                <div className="flex flex-wrap items-center gap-6 py-4 border-y border-zinc-800/50">
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">State</span>
                        <MultiSelect
                            multiple={false}
                            options={[
                                { label: "To Do", value: "To Do" },
                                { label: "New", value: "New" },
                                { label: "Active", value: "Active" },
                                { label: "Resolved", value: "Resolved" },
                                { label: "Closed", value: "Closed" },
                                { label: "Done", value: "Done" }
                            ]}
                            selected={item.fields["System.State"]}
                            onChange={(val) => handleUpdateState(val)}
                            className="min-w-[140px]"
                        />
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Assigned To</span>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-md text-sm text-zinc-300 border border-zinc-800">
                            <User className="h-4 w-4 text-zinc-500" />
                            <span>{item.fields["System.AssignedTo"]?.displayName || "Unassigned"}</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Last Changed</span>
                        <div className="flex items-center gap-2 px-1 py-1.5 text-sm text-zinc-400">
                            <Clock className="h-4 w-4 text-zinc-600" />
                            <span>{new Date(item.fields["System.ChangedDate"]).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section className="space-y-3">
                        <h3 className="text-lg font-semibold text-zinc-200">Description</h3>
                        <div
                            className="p-4 bg-zinc-900/30 rounded-xl border border-zinc-800 text-zinc-300 leading-relaxed prose prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: item.fields["System.Description"] || "<p class='italic text-zinc-600'>No description provided.</p>" }}
                        />
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                            <MessageSquare className="h-5 w-5 text-blue-500" />
                            <h3>Discussion</h3>
                        </div>

                        <form onSubmit={handleAddComment} className="space-y-3">
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-all min-h-[100px] resize-none"
                            />
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={!comment.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all shadow-lg"
                                >
                                    <Send className="h-4 w-4" />
                                    Post Comment
                                </button>
                            </div>
                        </form>
                    </section>
                </div>

                <div className="space-y-6">
                    <div className="p-5 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Details</h4>

                        <div className="space-y-4">
                            <DetailItem label="Priority" value={item.fields["Microsoft.VSTS.Common.Priority"]} />
                            <DetailItem label="Area" value={item.fields["System.AreaPath"]} />
                            <DetailItem label="Iteration" value={item.fields["System.IterationPath"]} />
                            <DetailItem label="Project" value={item.fields["System.TeamProject"]} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DetailItem({ label, value }: { label: string, value: any }) {
    return (
        <div className="space-y-1">
            <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-tight">{label}</div>
            <div className="text-sm text-zinc-300 truncate font-medium">{value ?? "—"}</div>
        </div>
    );
}
