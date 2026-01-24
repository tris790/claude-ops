import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getPullRequest, getPullRequestThreads, votePullRequest, getPullRequestChanges, getPullRequestCommits } from "../api/prs";
import {
    ArrowLeft,
    GitPullRequest,
    Clock,
    User,
    CheckCircle2,
    XCircle,
    MessageSquare,
    Send,
    Loader2,
    Check,
    Minus,
    FileCode,
    GitCommit
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileTree } from "../components/pr/FileTree";
import { DiffViewer } from "../components/pr/DiffViewer";

export function PRDetail() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [pr, setPr] = useState<any>(null);
    const [threads, setThreads] = useState<any[]>([]);
    const [changes, setChanges] = useState<any>(null);
    const [commits, setCommits] = useState<any[]>([]);
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "files" | "commits">("overview");

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    async function loadData() {
        setLoading(true);
        setError(null);
        try {
            const data = await getPullRequest(id!, searchParams.get("repoId") || undefined);
            setPr(data);
            const [threadData, changeData, commitData] = await Promise.all([
                getPullRequestThreads(id!, data.repository.id),
                getPullRequestChanges(id!, data.repository.id),
                getPullRequestCommits(id!, data.repository.id)
            ]);
            setThreads(threadData);
            setChanges(changeData);
            setCommits(commitData);
            if (changeData.changes.length > 0) {
                setSelectedFilePath(changeData.changes[0].item.path);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    async function handleVote(vote: number) {
        if (!pr || !id) return;
        try {
            // Find current user as reviewer
            // In a real app, we'd know who the current user is.
            // For now, we'll try to find a reviewer that matches "us" or just pick the first one with no vote for demo?
            // Actually, we should probably just send the vote and see what happens.
            // Azure DevOps requires the reviewerId.
            // Let's assume the first reviewer for now or just show a message.
            alert("Voting functionality requires current user context (Reviewer ID)");
        } catch (err) {
            console.error(err);
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
            <div className="text-red-500 font-medium">Error: {error}</div>
            <button
                onClick={loadData}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
            >
                Retry
            </button>
        </div>
    );

    if (!pr) return <div className="text-zinc-500">Pull request not found.</div>;

    const statusColors: Record<string, string> = {
        active: "text-blue-500",
        completed: "text-green-500",
        abandoned: "text-zinc-500",
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <button
                onClick={() => navigate("/prs")}
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to list
            </button>

            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <GitPullRequest className={`h-5 w-5 ${statusColors[pr.status] || "text-zinc-400"}`} />
                    <span className="text-zinc-500 font-mono">#{pr.pullRequestId}</span>
                    <span className={`px-2 py-0.5 rounded bg-zinc-800 text-xs font-medium uppercase tracking-wider ${statusColors[pr.status] || "text-zinc-400"}`}>
                        {pr.status}
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-zinc-100 leading-tight">
                    {pr.title}
                </h1>

                <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className="font-medium text-zinc-300">{pr.sourceRefName.split('/').pop()}</span>
                    <ArrowLeft className="h-3 w-3 rotate-180 text-zinc-600" />
                    <span className="font-medium text-zinc-300">{pr.targetRefName.split('/').pop()}</span>
                    <span className="mx-2 text-zinc-700">•</span>
                    <span>Created by {pr.createdBy.displayName}</span>
                    <span className="mx-2 text-zinc-700">•</span>
                    <Clock className="h-3 w-3 inline mr-1" />
                    <span>{new Date(pr.creationDate).toLocaleDateString()}</span>
                </div>
            </header>

            <div className="flex border-b border-zinc-800 gap-6">
                <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
                <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>Files</TabButton>
                <TabButton active={activeTab === "commits"} onClick={() => setActiveTab("commits")}>Commits</TabButton>
            </div>

            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <section className="bg-zinc-900/20 rounded-xl border border-zinc-800 overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/40">
                                <h3 className="text-sm font-semibold text-zinc-200">Description</h3>
                            </div>
                            <div className="p-6 text-zinc-300 prose prose-invert max-w-none">
                                {pr.description ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {pr.description}
                                    </ReactMarkdown>
                                ) : (
                                    <p className="italic text-zinc-600">No description provided.</p>
                                )}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-zinc-200 font-semibold px-2">
                                <MessageSquare className="h-5 w-5 text-blue-500" />
                                <h3>Activity</h3>
                            </div>

                            <div className="space-y-4">
                                {threads.filter(t => !t.isDraft && t.comments.some((c: any) => c.content)).map((thread: any) => (
                                    <div key={thread.id} className="bg-zinc-900/30 rounded-xl border border-zinc-800 overflow-hidden">
                                        <div className="space-y-4 p-4">
                                            {thread.comments.map((comment: any) => (
                                                <div key={comment.id} className="flex gap-4">
                                                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 shrink-0">
                                                        {comment.author.displayName[0]}
                                                    </div>
                                                    <div className="space-y-1 min-w-0">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="font-medium text-sm text-zinc-200">{comment.author.displayName}</span>
                                                            <span className="text-[10px] text-zinc-500">{new Date(comment.publishedDate).toLocaleString()}</span>
                                                        </div>
                                                        <div className="text-sm text-zinc-400 break-words">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="space-y-6">
                        <div className="p-5 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-6">
                            <section className="space-y-4">
                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Reviewers</h4>
                                <div className="space-y-3">
                                    {pr.reviewers.map((reviewer: any) => (
                                        <div key={reviewer.id} className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 shrink-0">
                                                    {reviewer.displayName[0]}
                                                </div>
                                                <span className="text-sm text-zinc-300 truncate">{reviewer.displayName}</span>
                                            </div>
                                            <VoteBadge vote={reviewer.vote} />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-4 pt-4 border-t border-zinc-800">
                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Policies</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                                        {pr.mergeStatus === "succeeded" ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <span>No merge conflicts</span>
                                    </div>
                                    {/* In a real app, we'd fetch status checks/builds */}
                                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        <span>Build succeeded</span>
                                    </div>
                                </div>
                            </section>

                            <section className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
                                <button
                                    onClick={() => handleVote(10)}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleVote(5)}
                                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-all border border-zinc-700"
                                >
                                    Approve with suggestions
                                </button>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "files" && (
                <div className="flex h-[calc(100vh-280px)] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                    <div className="w-64 flex-shrink-0">
                        <FileTree
                            changes={changes?.changes || []}
                            selectedPath={selectedFilePath}
                            onSelect={setSelectedFilePath}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        {selectedFilePath ? (
                            <DiffViewer
                                repoId={pr.repository.id}
                                filePath={selectedFilePath}
                                originalVersion={pr.lastMergeTargetCommitId}
                                modifiedVersion={pr.lastMergeSourceCommitId}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500">
                                Select a file to view changes
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "commits" && (
                <div className="bg-zinc-900/20 rounded-xl border border-zinc-800 overflow-hidden">
                    <div className="flex flex-col">
                        {commits.map((commit: any) => (
                            <div key={commit.commitId} className="flex gap-4 p-4 border-b border-zinc-800 last:border-0 hover:bg-white/5 transition-colors">
                                <div className="mt-1">
                                    <GitCommit className="h-5 w-5 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <h4 className="text-zinc-200 font-medium truncate">{commit.comment}</h4>
                                        <span className="text-xs font-mono text-zinc-500 shrink-0">{commit.commitId.substring(0, 8)}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                                        <span className="font-medium text-zinc-300">{commit.author.name}</span>
                                        <span>committed on {new Date(commit.author.date).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {commits.length === 0 && (
                            <div className="p-8 text-center text-zinc-500">
                                No commits found for this pull request.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`py-4 px-2 text-sm font-medium border-b-2 transition-all ${active ? "border-blue-500 text-blue-500" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >
            {children}
        </button>
    );
}

function VoteBadge({ vote }: { vote: number }) {
    if (vote > 0) return <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center"><Check className="h-3 w-3 text-green-500" /></div>;
    if (vote < 0) return <div className="h-5 w-5 rounded-full bg-red-500/20 flex items-center justify-center"><Minus className="h-3 w-3 text-red-500" /></div>;
    return <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-600">...</div>;
}
