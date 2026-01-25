import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getPullRequest, getPullRequestThreads, votePullRequest, getPullRequestChanges, getPullRequestCommits, createPullRequestThread, getPullRequestIterations } from "../api/prs";
import { getCurrentUser } from "../api/auth";
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
    GitCommit,
    ChevronDown,
    PanelLeftClose,
    PanelLeftOpen
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { FileTree } from "../components/pr/FileTree";
import { DiffViewer } from "../components/pr/DiffViewer";
import { CompleteDialog } from "../components/pr/CompleteDialog";
import { IterationSelector } from "../components/pr/IterationSelector";

export function PRDetail() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [pr, setPr] = useState<any>(null);
    const [threads, setThreads] = useState<any[]>([]);
    const [changes, setChanges] = useState<any>(null);
    const [commits, setCommits] = useState<any[]>([]);
    const [iterations, setIterations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [postingComment, setPostingComment] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [reviewMenuOpen, setReviewMenuOpen] = useState(false);
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
    const [reviewedFiles, setReviewedFiles] = useState<Set<string>>(new Set());
    const [treeWidth, setTreeWidth] = useState(() => {
        const saved = localStorage.getItem("pr-tree-width");
        return saved ? parseInt(saved, 10) : 256;
    });
    const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);
    const [lastReviewedIterationId, setLastReviewedIterationId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Sync state with URL search params
    const selectedIteration = searchParams.get("iteration") ? parseInt(searchParams.get("iteration")!, 10) : null;
    const selectedBaseIteration = searchParams.get("baseIteration") ? parseInt(searchParams.get("baseIteration")!, 10) : null;
    const selectedFilePath = searchParams.get("path");
    const activeTab = (searchParams.get("tab") as any) || "overview";

    const updateQueryParams = (params: Record<string, string | null>, replace = false) => {
        const nextParams = new URLSearchParams(searchParams);
        Object.entries(params).forEach(([key, value]) => {
            if (value === null) nextParams.delete(key);
            else nextParams.set(key, value);
        });
        navigate(`?${nextParams.toString()}`, { replace });
    };

    const setActiveTab = (tab: string) => updateQueryParams({ tab });
    const setSelectedFilePath = (path: string | null, replace = false) => updateQueryParams({ path, line: null }, replace);

    useEffect(() => {
        if (id) {
            loadData();
            // Load reviewed files from localStorage
            const saved = localStorage.getItem(`pr-${id}-reviewed`);
            if (saved) {
                try {
                    setReviewedFiles(new Set(JSON.parse(saved)));
                } catch (e) {
                    console.error("Failed to parse reviewed files", e);
                }
            }
            // Load last reviewed iteration
            const savedIter = localStorage.getItem(`pr-${id}-last-reviewed-iteration`);
            if (savedIter) {
                setLastReviewedIterationId(parseInt(savedIter, 10));
            }
        }
    }, [id]);

    async function loadData() {
        setLoading(true);
        setError(null);
        try {
            const data = await getPullRequest(id!, searchParams.get("repoId") || undefined);
            setPr(data);
            const [threadData, changeData, commitData, iterData, userData] = await Promise.all([
                getPullRequestThreads(id!, data.repository.id),
                getPullRequestChanges(id!, data.repository.id),
                getPullRequestCommits(id!, data.repository.id),
                getPullRequestIterations(id!, data.repository.id),
                getCurrentUser().catch(() => null)
            ]);
            setThreads(threadData);
            setChanges(changeData);
            setCommits(commitData);
            setIterations(iterData);
            setCurrentUser(userData);
            if (changeData.changes.length > 0 && !selectedFilePath) {
                setSelectedFilePath(changeData.changes[0].item.path, true);
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

        if (!currentUser) {
            alert("Unable to identify current user. Please ensure you are authenticated.");
            return;
        }

        // Find current user in reviewers list
        // Try matching by uniqueName (email) or id
        const reviewer = pr.reviewers.find((r: any) =>
            r.uniqueName === currentUser.emailAddress ||
            r.id === currentUser.id ||
            r.displayName === currentUser.providerDisplayName
        );

        if (!reviewer) {
            console.log("User not in reviewers list, auto-joining/voting as current user.");
        }

        const reviewerId = reviewer ? reviewer.id : currentUser.id;

        try {
            await votePullRequest(id, pr.repository.id, reviewerId, vote);

            // Update last reviewed iteration
            const latestId = iterations.reduce((max, it) => Math.max(max, it.id), 0);
            if (latestId > 0) {
                setLastReviewedIterationId(latestId);
                localStorage.setItem(`pr-${id}-last-reviewed-iteration`, latestId.toString());
            }

            // Optimistic update or reload
            const updatedPr = await getPullRequest(id, pr.repository.id);
            setPr(updatedPr);
            setReviewMenuOpen(false);
        } catch (err: any) {
            console.error(err);
            alert("Failed to submit vote: " + err.message);
        }
    }

    const scrollToLine = searchParams.get("line") ? parseInt(searchParams.get("line")!, 10) : null;

    const jumpToContext = (thread: any) => {
        if (!thread.threadContext) return;
        const line = thread.threadContext.rightFileStart?.line || thread.threadContext.leftFileStart?.line;
        updateQueryParams({
            tab: "files",
            path: thread.threadContext.filePath,
            line: line?.toString() || null
        }, false);
    };

    async function handlePostComment() {
        if (!newComment.trim() || !pr || !id) return;

        setPostingComment(true);
        try {
            await createPullRequestThread(id, pr.repository.id, newComment);
            setNewComment("");

            // Refresh threads
            const threadData = await getPullRequestThreads(id, pr.repository.id);
            setThreads(threadData);
        } catch (err: any) {
            console.error(err);
            alert("Failed to post comment: " + err.message);
        } finally {
            setPostingComment(false);
        }
    }

    async function handleIterationSelect(iterId: number | null, baseIterId: number | null) {
        setLoading(true);
        try {
            const data = await getPullRequestChanges(
                id!,
                pr.repository.id,
                iterId?.toString(),
                baseIterId?.toString()
            );
            setChanges(data);

            const nextParams: Record<string, string | null> = {
                iteration: iterId?.toString() || null,
                baseIteration: baseIterId?.toString() || null
            };

            if (data.changes.length > 0) {
                // Try to keep selected file if it exists in new changes
                const exists = data.changes.find((c: any) => c.item.path === selectedFilePath);
                if (!exists) {
                    nextParams.path = data.changes[0].item.path;
                    nextParams.line = null;
                }
            } else {
                nextParams.path = null;
                nextParams.line = null;
            }
            updateQueryParams(nextParams, false);
        } catch (err: any) {
            console.error("Failed to fetch changes for iteration", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function toggleFileReviewed(path: string) {
        setReviewedFiles(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            localStorage.setItem(`pr-${id}-reviewed`, JSON.stringify(Array.from(next)));
            return next;
        });
    }

    // Determine commit IDs for DiffViewer
    let originalVersion = pr?.lastMergeTargetCommitId;
    let modifiedVersion = pr?.lastMergeSourceCommitId;

    if (iterations.length > 0 && selectedIteration !== null) {
        const iter = iterations.find(i => i.id === selectedIteration);
        if (iter) {
            modifiedVersion = iter.sourceRefCommit.commitId;

            if (selectedBaseIteration !== null && selectedBaseIteration > 0) {
                const baseIter = iterations.find(i => i.id === selectedBaseIteration);
                if (baseIter) {
                    originalVersion = baseIter.sourceRefCommit.commitId;
                }
            } else {
                // Considering comparison against base
                originalVersion = iter.commonRefCommit.commitId;
            }
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <Loader2 className="h-8 w-8 text-sapphire-500 animate-spin" />
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
        active: "text-sapphire-500",
        completed: "text-green-500",
        abandoned: "text-zinc-500",
    };

    const hasRejections = pr.reviewers.some((r: any) => r.vote === -10);
    const hasConflicts = pr.mergeStatus !== "succeeded";
    const canComplete = !hasRejections && !hasConflicts && pr.status === 'active';

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            <CompleteDialog
                isOpen={completeDialogOpen}
                onClose={() => setCompleteDialogOpen(false)}
                pr={pr}
                onComplete={() => {
                    loadData(); // Refresh all data
                }}
            />

            {/* Header Section - Compact */}
            <header className="w-full border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                onClick={() => navigate("/prs")}
                                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                                title="Back to list"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-zinc-500 font-mono text-xs shrink-0">#{pr.pullRequestId}</span>
                                <h1 className="text-base font-bold text-zinc-100 truncate">
                                    {pr.title}
                                </h1>
                                <span className={`px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold uppercase tracking-wider ${statusColors[pr.status] || "text-zinc-400"}`}>
                                    {pr.status}
                                </span>
                            </div>
                        </div>

                        {pr.status === 'active' && (
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => setCompleteDialogOpen(true)}
                                    disabled={!canComplete}
                                    title={!canComplete ? (hasRejections ? "Cannot complete: Reviews rejected" : "Cannot complete: Merge conflicts or status issues") : "Complete Pull Request"}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm ${canComplete ? "bg-zinc-100 hover:bg-white text-zinc-900" : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"}`}
                                >
                                    <Check className="h-3.5 w-3.5" />
                                    Complete
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setReviewMenuOpen(!reviewMenuOpen)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sapphire-600 hover:bg-sapphire-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Review
                                        <ChevronDown className={`h-3 w-3 transition-transform ${reviewMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {reviewMenuOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setReviewMenuOpen(false)}
                                            />
                                            <div className="absolute right-0 mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                                                <button onClick={() => handleVote(10)} className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-xs text-zinc-200 flex items-center gap-2">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                                    <span>Approve</span>
                                                </button>
                                                <button onClick={() => handleVote(5)} className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-xs text-zinc-200 flex items-center gap-2">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
                                                    <span>Approve with suggestions</span>
                                                </button>
                                                <button onClick={() => handleVote(-5)} className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-xs text-zinc-200 flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                                                    <span>Wait for author</span>
                                                </button>
                                                <button onClick={() => handleVote(-10)} className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-xs text-zinc-200 flex items-center gap-2 text-red-400">
                                                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                                                    <span>Reject</span>
                                                </button>
                                                <div className="h-px bg-zinc-800 my-1"></div>
                                                <button onClick={() => handleVote(0)} className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
                                                    <Minus className="h-3.5 w-3.5" />
                                                    <span>Reset feedback</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex gap-4">
                            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
                            <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>Files</TabButton>
                            <TabButton active={activeTab === "commits"} onClick={() => setActiveTab("commits")}>Commits</TabButton>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                            <div className="flex items-center gap-1 bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-800">
                                <span className="text-zinc-400 font-medium mr-1">{pr.repository.name}</span>
                                <span className="font-mono text-zinc-300">{pr.sourceRefName.split('/').pop()}</span>
                                <ArrowLeft className="h-3 w-3 rotate-180 text-zinc-600" />
                                <span className="font-mono text-zinc-300">{pr.targetRefName.split('/').pop()}</span>
                            </div>
                            <span className="text-zinc-700">•</span>
                            <span>Created by <span className="text-zinc-300 font-medium">{pr.createdBy.displayName}</span></span>
                            <span className="text-zinc-700">•</span>
                            <span>{new Date(pr.creationDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1">
                {activeTab === "overview" && (
                    <div className="max-w-6xl mx-auto w-full px-6 py-6">
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
                                        <MessageSquare className="h-5 w-5 text-sapphire-500" />
                                        <h3>Activity</h3>
                                    </div>

                                    <div className="space-y-4">
                                        {/* New Comment Input */}
                                        <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 p-4 space-y-3">
                                            <textarea
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                                placeholder="Leave a comment..."
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 focus:border-sapphire-500 focus:ring-1 focus:ring-sapphire-500 outline-none min-h-[100px] resize-y placeholder-zinc-600"
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={handlePostComment}
                                                    disabled={postingComment || !newComment.trim()}
                                                    className="flex items-center gap-2 px-4 py-2 bg-sapphire-600 hover:bg-sapphire-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
                                                >
                                                    {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                    Comment
                                                </button>
                                            </div>
                                        </div>
                                        {threads.filter(t => !t.isDraft && t.comments.some((c: any) => c.content)).map((thread: any) => (
                                            <div key={thread.id} className="bg-zinc-900/30 rounded-xl border border-zinc-800 overflow-hidden">
                                                {thread.threadContext && (
                                                    <button
                                                        onClick={() => jumpToContext(thread)}
                                                        className="w-full px-4 py-2 bg-zinc-800/40 border-b border-zinc-800 flex items-center gap-2 hover:bg-zinc-800/60 transition-colors group"
                                                    >
                                                        <FileCode className="h-3.5 w-3.5 text-zinc-500 group-hover:text-sapphire-400 transition-colors" />
                                                        <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-200 truncate flex-1 text-left">
                                                            {thread.threadContext.filePath}
                                                            <span className="text-zinc-600 ml-2 group-hover:text-zinc-500">
                                                                L{thread.threadContext.rightFileStart?.line || thread.threadContext.leftFileStart?.line}
                                                            </span>
                                                        </span>
                                                    </button>
                                                )}
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
                                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                <span>Build succeeded</span>
                                            </div>
                                        </div>
                                    </section>

                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "files" && (
                    <div className="flex flex-col h-full bg-zinc-950">
                        <div className="flex h-[calc(100vh-120px)] border-zinc-800 overflow-hidden relative">
                            {/* Sidebar Expand Button (visible only when collapsed) */}
                            {isTreeCollapsed && (
                                <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col items-center py-4 bg-zinc-900 border-r border-zinc-800 z-30 shadow-xl">
                                    <button
                                        onClick={() => setIsTreeCollapsed(false)}
                                        className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                                        title="Expand Sidebar"
                                    >
                                        <PanelLeftOpen className="h-4 w-4" />
                                    </button>
                                </div>
                            )}

                            {!isTreeCollapsed && (
                                <div
                                    className="flex-shrink-0 border-r border-zinc-800 bg-zinc-900/30 flex flex-col"
                                    style={{ width: treeWidth }}
                                >
                                    <div className="p-2 border-b border-zinc-800 flex items-center justify-between gap-2 overflow-hidden">
                                        <div className="flex-1 min-w-0">
                                            <IterationSelector
                                                iterations={iterations}
                                                selectedIteration={selectedIteration}
                                                selectedBaseIteration={selectedBaseIteration}
                                                lastReviewedIterationId={lastReviewedIterationId}
                                                onSelect={handleIterationSelect}
                                            />
                                        </div>
                                        <button
                                            onClick={() => setIsTreeCollapsed(true)}
                                            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                                            title="Collapse Sidebar"
                                        >
                                            <PanelLeftClose className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <FileTree
                                            changes={changes?.changes || []}
                                            selectedPath={selectedFilePath}
                                            onSelect={setSelectedFilePath}
                                            reviewedFiles={reviewedFiles}
                                            onToggleReviewed={toggleFileReviewed}
                                        />
                                    </div>
                                </div>
                            )}

                            {!isTreeCollapsed && (
                                <div
                                    className="w-1 cursor-col-resize hover:bg-sapphire-500/50 transition-colors active:bg-sapphire-500 z-10 shrink-0"
                                    onMouseDown={(e) => {
                                        const startX = e.pageX;
                                        const startWidth = treeWidth;

                                        function onMouseMove(e: MouseEvent) {
                                            const delta = e.pageX - startX;
                                            const newWidth = Math.max(150, Math.min(600, startWidth + delta));
                                            setTreeWidth(newWidth);
                                            localStorage.setItem("pr-tree-width", newWidth.toString());
                                        }

                                        function onMouseUp() {
                                            window.removeEventListener("mousemove", onMouseMove);
                                            window.removeEventListener("mouseup", onMouseUp);
                                            document.body.style.cursor = "default";
                                        }

                                        window.addEventListener("mousemove", onMouseMove);
                                        window.addEventListener("mouseup", onMouseUp);
                                        document.body.style.cursor = "col-resize";
                                    }}
                                />
                            )}
                            <div className={`flex-1 min-w-0 bg-zinc-950 ${isTreeCollapsed ? 'ml-10' : ''}`}>
                                {selectedFilePath ? (
                                    <DiffViewer
                                        repoId={pr.repository.id}
                                        filePath={selectedFilePath}
                                        originalVersion={originalVersion}
                                        modifiedVersion={modifiedVersion}
                                        projectName={pr.repository.project.name}
                                        repoName={pr.repository.name}
                                        isCloned={pr.repository.isCloned}
                                        pullRequestId={pr.pullRequestId}
                                        isReviewed={selectedFilePath ? reviewedFiles.has(selectedFilePath) : false}
                                        onToggleReviewed={() => selectedFilePath && toggleFileReviewed(selectedFilePath)}
                                        threads={threads}
                                        onCommentPosted={() => {
                                            getPullRequestThreads(id!, pr.repository.id).then(setThreads);
                                        }}
                                        scrollToLine={scrollToLine}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-zinc-500">
                                        Select a file to view changes
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "commits" && (
                    <div className="max-w-6xl mx-auto w-full px-6 py-6">
                        <div className="bg-zinc-900/20 rounded-xl border border-zinc-800 overflow-hidden">
                            <div className="flex flex-col">
                                {commits.map((commit: any) => (
                                    <div key={commit.commitId} className="flex gap-4 p-4 border-b border-zinc-800 last:border-0 hover:bg-white/5 transition-colors">
                                        <div className="mt-1">
                                            <GitCommit className="h-5 w-5 text-sapphire-500" />
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
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`py-2 px-1 text-xs font-medium border-b-2 transition-all ${active ? "border-sapphire-500 text-sapphire-500" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
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
