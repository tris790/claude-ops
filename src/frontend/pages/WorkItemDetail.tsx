import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getWorkItemDetails, updateWorkItem, addWorkItemComment } from "../api/work-items";
import {
    ArrowLeft,
    User,
    Clock,
    MessageSquare,
    Send,
    Loader2,
    Sparkles,
    Terminal,
    X,
    Play,
    GitBranch,
    Pencil,
    Check
} from "lucide-react";
import { MultiSelect } from "../components/ui/MultiSelect";
import { runAutomation } from "../api/automation";
import { getRepositories } from "../api/repos";
import { useRepoContext } from "../contexts/RepoContext";

export function WorkItemDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [comment, setComment] = useState("");
    const [agentVisible, setAgentVisible] = useState(false);
    const [agentStatus, setAgentStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
    const [agentOutput, setAgentOutput] = useState("");
    const [repos, setRepos] = useState<any[]>([]);
    const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [descContent, setDescContent] = useState("");
    const { clearContext } = useRepoContext();

    // Clear repo context when on work item detail page
    useEffect(() => {
        clearContext();
    }, [clearContext]);

    useEffect(() => {
        if (id) loadItem(parseInt(id));
        loadRepos();
    }, [id]);

    async function loadRepos() {
        try {
            const list = await getRepositories();
            setRepos(list);
            // Default to first repo if available
            if (list.length > 0 && list[0]) setSelectedRepos([list[0].name]);
        } catch (e) {
            console.error("Failed to load repos", e);
        }
    }

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

    async function handleSaveDescription() {
        if (!id || !item) return;
        setSaving(true);
        try {
            const updated = await updateWorkItem(parseInt(id), { "System.Description": descContent });
            setItem(updated);
            setIsEditingDesc(false);
        } catch (err) {
            alert("Failed to update description");
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

    async function handleStartAgent() {
        if (!item || selectedRepos.length === 0) return;
        setAgentStatus("running");
        setAgentOutput(`Initializing Autonomous Agent...\n> Target Repos: ${selectedRepos.join(", ")}\n> Reading Work Item #${item.id}\n> Analyzing requirements...`);

        try {
            // Find details of first selected repo for org context
            const primaryRepo = repos.find(r => r.name === selectedRepos[0]);

            const context = {
                id: item.id,
                title: item.fields["System.Title"],
                description: item.fields["System.Description"] || "",
                project: item.fields["System.TeamProject"],
                repos: selectedRepos.join(", "),
                // Assuming the repo URL contains the org name or we default to a known env var in backend
                organization: primaryRepo?.webUrl ? primaryRepo.webUrl.split('/')[3] : "Unknown"
            };

            setAgentOutput(prev => prev + "\n> Connecting to codebase...");
            const res = await runAutomation("implement_work_item", context);

            if (res.success) {
                setAgentOutput(prev => prev + "\n\n" + res.output + "\n\n> IMPLEMENTATION COMPLETE.");
                setAgentStatus("completed");
            } else {
                throw new Error(res.error || "Unknown error");
            }
        } catch (err: any) {
            setAgentOutput(prev => prev + "\n\n[ERROR]: " + err.message);
            setAgentStatus("error");
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
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors text-sm"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to list
            </button>

            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <span className="text-zinc-500 font-mono text-lg">#{item.id}</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider">
                        {item.fields["System.WorkItemType"]}
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                    {item.fields["System.Title"]}
                </h1>

                {/* Agent Trigger */}
                <div className="flex justify-end">
                    <button
                        onClick={() => setAgentVisible(!agentVisible)}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border
                            ${agentVisible
                                ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-500"
                            }
                        `}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Implement with AI
                    </button>
                </div>

                {agentVisible && (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-900/10 text-sm">
                        <div className="flex items-center justify-between px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 rounded-t-xl">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                                <Terminal className="h-4 w-4" />
                                <span>Autonomous Agent</span>
                            </div>
                            <button onClick={() => setAgentVisible(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {agentStatus === "idle" ? (
                                <div className="space-y-4">
                                    <p className="text-zinc-600 dark:text-zinc-300">
                                        The agent will analyze this work item, modify the codebase, and create a PR for you.
                                    </p>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Target Repositories</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <MultiSelect
                                                    multiple={true}
                                                    options={repos.map(r => ({ label: r.name, value: r.name }))}
                                                    selected={selectedRepos}
                                                    onChange={(val) => setSelectedRepos(val)}
                                                    placeholder="Select repositories..."
                                                    className="w-full" // Changed from w-72 to w-full based on previous style
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleStartAgent}
                                            disabled={selectedRepos.length === 0}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-all shadow-sm hover:shadow-blue-500/25"
                                        >
                                            <Play className="h-3.5 w-3.5" />
                                            Start Implementation
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 uppercase">
                                        {agentStatus === "running" && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                                        <span className={agentStatus === "running" ? "text-blue-500" : agentStatus === "error" ? "text-red-500" : "text-green-500"}>
                                            Status: {agentStatus}
                                        </span>
                                    </div>
                                    <div className="bg-zinc-950 rounded-lg p-3 font-mono text-xs text-zinc-300 h-48 overflow-y-auto whitespace-pre-wrap border border-zinc-800/50 shadow-inner">
                                        {agentOutput}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-6 py-4 border-y border-zinc-200 dark:border-zinc-800/50">
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
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
                            <User className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
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
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200">Description</h3>
                            {!isEditingDesc && (
                                <button
                                    onClick={() => {
                                        setDescContent(item.fields["System.Description"] || "");
                                        setIsEditingDesc(true);
                                    }}
                                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {isEditingDesc ? (
                            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                <textarea
                                    value={descContent}
                                    onChange={(e) => setDescContent(e.target.value)}
                                    className="w-full min-h-[200px] p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 hover:border-blue-500/50 transition-all resize-y"
                                    placeholder="Enter description (HTML supported)..."
                                />
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => setIsEditingDesc(false)}
                                        className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveDescription}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="p-4 bg-white dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 leading-relaxed prose prose-zinc dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: item.fields["System.Description"] || "<p class='italic text-zinc-500 dark:text-zinc-600'>No description provided.</p>" }}
                            />
                        )}
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-200 font-semibold">
                            <MessageSquare className="h-5 w-5 text-blue-500" />
                            <h3>Discussion</h3>
                        </div>

                        <form onSubmit={handleAddComment} className="space-y-3">
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm text-zinc-900 dark:text-zinc-200 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-all min-h-[100px] resize-none"
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
                    <div className="p-5 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
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
            <div className="text-[10px] text-zinc-500 dark:text-zinc-600 uppercase font-bold tracking-tight">{label}</div>
            <div className="text-sm text-zinc-800 dark:text-zinc-300 truncate font-medium">{value ?? "—"}</div>
        </div>
    );
}
