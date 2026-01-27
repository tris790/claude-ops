import React from "react";
import { createRoot } from "react-dom/client";
import { StateField, StateEffect } from "@codemirror/state";
import { EditorView, Decoration, WidgetType, showTooltip, type Tooltip, type DecorationSet } from "@codemirror/view";
import { MessageSquarePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CommentDialog } from "./CommentDialog";
import { createPullRequestThread, updatePullRequestComment, deletePullRequestComment, updatePullRequestThread, addPullRequestComment } from "../../api/prs";
import { Edit2, Trash2, CheckCircle2, RotateCcw, Reply, MoreVertical, ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { ThreadStatusPicker, isThreadResolved, isThreadClosed } from "./ThreadStatusPicker";
import { runAutomation } from "../../api/automation";

// --- Types ---

interface CommentDraft {
    id: string;
    from: number;
    to: number;
    side: "original" | "modified";
    originalLine: number;
    originalOffset: number;
    modifiedLine: number;
    modifiedOffset: number;
}

interface CommentSystemProps {
    pullRequestId?: string;
    repoId: string;
    filePath: string;
    side: "original" | "modified";
    threads?: any[];
    onCommentPosted?: () => void;
    currentUser?: any;
    projectName?: string;
    repoName?: string;
    sourceBranch?: string;
}

// --- Effects ---

const addDraftEffect = StateEffect.define<CommentDraft>();
const removeDraftEffect = StateEffect.define<string>(); // id

// --- Widgets ---

class CommentDraftWidget extends WidgetType {
    constructor(
        private draft: CommentDraft,
        private props: CommentSystemProps
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const dom = document.createElement("div");
        dom.className = "cm-comment-draft-widget z-50 absolute";

        const root = createRoot(dom);

        const draftKey = `draft_${this.props.pullRequestId}_${this.props.filePath}_${this.draft.side}_${this.draft.originalLine}`;

        const handleSave = async (content: string) => {
            if (!this.props.pullRequestId) {
                alert("Cannot comment: No Pull Request Context");
                return;
            }

            // Construction thread context
            const threadContext = {
                filePath: this.props.filePath,
                rightFileStart: this.props.side === 'modified' ? { line: this.draft.modifiedLine, offset: this.draft.modifiedOffset } : undefined,
                rightFileEnd: this.props.side === 'modified' ? { line: this.draft.modifiedLine, offset: this.draft.modifiedOffset } : undefined,
                leftFileStart: this.props.side === 'original' ? { line: this.draft.originalLine, offset: this.draft.originalOffset } : undefined,
                leftFileEnd: this.props.side === 'original' ? { line: this.draft.originalLine, offset: this.draft.originalOffset } : undefined,
            };

            try {
                await createPullRequestThread(
                    this.props.pullRequestId!,
                    this.props.repoId,
                    content,
                    threadContext
                );

                // Access view to dispatch remove effect
                view.dispatch({
                    effects: removeDraftEffect.of(this.draft.id)
                });

                // Trigger refresh
                this.props.onCommentPosted?.();
            } catch (err: any) {
                alert("Failed to save comment: " + err.message);
            }
        };

        const handleCancel = () => {
            view.dispatch({
                effects: removeDraftEffect.of(this.draft.id)
            });
        };

        root.render(
            <div className="relative">
                <CommentDialog
                    draftKey={draftKey}
                    onSubmit={handleSave}
                    onCancel={handleCancel}
                />
            </div>
        );

        return dom;
    }

    override ignoreEvent() {
        return true;
    }
}

const CommentThread: React.FC<{ thread: any, props: CommentSystemProps }> = ({ thread, props }) => {
    const user = props.currentUser;
    const [editingCommentId, setEditingCommentId] = React.useState<number | null>(null);
    const [isReplying, setIsReplying] = React.useState(false);
    const isResolved = isThreadResolved(thread.status) || isThreadClosed(thread.status);
    const [isCollapsed, setIsCollapsed] = React.useState(isResolved);

    const handleUpdateComment = async (commentId: number, content: string) => {
        try {
            await updatePullRequestComment(props.pullRequestId!, props.repoId, thread.id, commentId, content);
            setEditingCommentId(null);
            props.onCommentPosted?.();
        } catch (err: any) {
            alert("Failed to update comment: " + err.message);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!confirm("Are you sure you want to delete this comment?")) return;
        try {
            await deletePullRequestComment(props.pullRequestId!, props.repoId, thread.id, commentId);
            props.onCommentPosted?.();
        } catch (err: any) {
            alert("Failed to delete comment: " + err.message);
        }
    };

    const handleUpdateThreadStatus = async (status: number | string) => {
        try {
            await updatePullRequestThread(props.pullRequestId!, props.repoId, thread.id, status as any);
            props.onCommentPosted?.();
        } catch (err: any) {
            alert("Failed to update thread status: " + err.message);
        }
    };

    const handleReply = async (content: string) => {
        try {
            await addPullRequestComment(props.pullRequestId!, props.repoId, thread.id, content);
            setIsReplying(false);
            props.onCommentPosted?.();
        } catch (err: any) {
            alert("Failed to reply: " + err.message);
        }
    };

    const [applyingFixId, setApplyingFixId] = React.useState<number | null>(null);

    const handleApplyFix = async (comment: any) => {
        if (!thread.threadContext || !props.projectName || !props.repoName || !props.sourceBranch) {
            alert("Missing context for automation (Project, Repo, or Source Branch).");
            return;
        }

        setApplyingFixId(comment.id);

        try {
            const filePath = thread.threadContext.filePath;
            const startLine = thread.threadContext.rightFileStart?.line || thread.threadContext.leftFileStart?.line || 0;
            const endLine = thread.threadContext.rightFileEnd?.line || thread.threadContext.leftFileEnd?.line || startLine;

            const contextHooks = {
                file_path: filePath.startsWith('/') ? filePath.substring(1) : filePath,
                branch: props.sourceBranch,
                comment: comment.content,
                code_context: `File: ${filePath}, Lines: ${startLine}-${endLine}`,
                projectName: props.projectName,
                repoName: props.repoName
            };

            const res = await runAutomation("apply_fix", contextHooks);

            if (res.success) {
                alert("Fix applied! Refreshing...");
                props.onCommentPosted?.();
            } else {
                alert("Failed to apply fix: " + (res.error || "Unknown error"));
            }
        } catch (err: any) {
            console.error(err);
            alert("Failed to apply fix: " + err.message);
        } finally {
            setApplyingFixId(null);
        }
    };

    return (
        <div className="p-2 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <ThreadStatusPicker
                        status={thread.status}
                        onStatusChange={handleUpdateThreadStatus}
                        compact
                    />
                    {isCollapsed && (
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-500 truncate max-w-[300px]">
                            {thread.comments[0]?.author?.displayName}: {thread.comments[0]?.content.substring(0, 60)}
                            {thread.comments[0]?.content.length > 60 ? "..." : ""}
                            {thread.comments.length > 1 ? ` (+${thread.comments.length - 1} replies)` : ""}
                        </span>
                    )}
                </div>
                <div className="flex items-center space-x-1">
                    {!isCollapsed && thread.comments.length > 0 && (
                        <>
                            {thread.threadContext && (
                                <button
                                    onClick={() => handleApplyFix(thread.comments[0])}
                                    disabled={applyingFixId === thread.comments[0].id}
                                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400"
                                    title="Apply Fix with AI"
                                >
                                    {applyingFixId === thread.comments[0].id ?
                                        <Loader2 className="w-3 h-3 animate-spin" /> :
                                        <Sparkles className="w-3 h-3" />
                                    }
                                </button>
                            )}
                            {user && thread.comments[0].author && user.id === thread.comments[0].author.id && (
                                <>
                                    <button
                                        onClick={() => setEditingCommentId(thread.comments[0].id)}
                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteComment(thread.comments[0].id)}
                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <div className="space-y-4 pt-2">
                    {thread.comments.filter((c: any) => c.content).map((comment: any, idx: number) => {
                        const isAuthor = user && comment.author && user.id === comment.author.id;
                        const isEditing = editingCommentId === comment.id;

                        if (isEditing) {
                            return (
                                <div key={comment.id || idx} className="mt-2">
                                    <CommentDialog
                                        draftKey={`edit_${comment.id}`}
                                        initialValue={comment.content}
                                        onSubmit={(content) => handleUpdateComment(comment.id, content)}
                                        onCancel={() => setEditingCommentId(null)}
                                    />
                                </div>
                            );
                        }

                        return (
                            <div key={comment.id || idx} className="flex gap-3 group">
                                <div className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 uppercase font-bold border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    {comment.author?.displayName?.[0] || "?"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between mb-0.5">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{comment.author?.displayName}</span>
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-tight">{new Date(comment.publishedDate).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            {idx > 0 && (
                                                <>
                                                    {thread.threadContext && (
                                                        <button
                                                            onClick={() => handleApplyFix(comment)}
                                                            disabled={applyingFixId === comment.id}
                                                            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400"
                                                            title="Apply Fix with AI"
                                                        >
                                                            {applyingFixId === comment.id ?
                                                                <Loader2 className="w-3 h-3 animate-spin" /> :
                                                                <Sparkles className="w-3 h-3" />
                                                            }
                                                        </button>
                                                    )}
                                                    {isAuthor && (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingCommentId(comment.id)}
                                                                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteComment(comment.id)}
                                                                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[13px] text-zinc-700 dark:text-zinc-300 prose prose-zinc dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-50 dark:prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-200 dark:prose-pre:border-zinc-800">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="flex items-center gap-2 pl-9">
                        {!isReplying ? (
                            <button
                                onClick={() => setIsReplying(true)}
                                className="flex items-center space-x-1.5 text-[11px] font-medium text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                                <Reply className="w-3 h-3" />
                                <span>Reply...</span>
                            </button>
                        ) : (
                            <div className="flex-1 mt-2">
                                <CommentDialog
                                    draftKey={`reply_${thread.id}`}
                                    onSubmit={handleReply}
                                    onCancel={() => setIsReplying(false)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

};

class CommentThreadWidget extends WidgetType {
    constructor(
        private thread: any,
        private props: CommentSystemProps
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const dom = document.createElement("div");
        dom.className = "cm-comment-thread-widget border-l-2 border-blue-500 bg-white dark:bg-zinc-900/40 my-2 rounded-r-md overflow-hidden animate-in slide-in-from-left-2 duration-200 shadow-lg sticky left-4 max-w-lg ring-1 ring-zinc-200 dark:ring-zinc-800";
        const root = createRoot(dom);
        root.render(<CommentThread thread={this.thread} props={this.props} />);
        return dom;
    }

    override ignoreEvent() {
        return true;
    }
}

// --- Extensions ---

export const createCommentSystem = (props: CommentSystemProps) => {

    const draftStateField = StateField.define<CommentDraft[]>({
        create() { return []; },
        update(drafts, tr) {
            for (const effect of tr.effects) {
                if (effect.is(addDraftEffect)) {
                    drafts = [...drafts, effect.value];
                } else if (effect.is(removeDraftEffect)) {
                    drafts = drafts.filter(d => d.id !== effect.value);
                }
            }
            return drafts;
        }
    });

    const commentDecorations = EditorView.decorations.compute([draftStateField], (state) => {
        const drafts = state.field(draftStateField);
        const decorations = [];

        // 1. Existing Threads
        const threads = props.threads || [];
        for (const thread of threads) {
            if (thread.isDraft || !thread.threadContext) continue;
            const context = thread.threadContext;

            const threadPath = context.filePath?.startsWith('/') ? context.filePath : `/${context.filePath}`;
            const propsPath = props.filePath?.startsWith('/') ? props.filePath : `/${props.filePath}`;

            if (threadPath !== propsPath) continue;

            // In side-by-side, we only show comments for the current side.
            // In unified or new-only, we might want to show all, but for now we follow the 'side' prop.
            // However, for unified, 'side' is 'modified'. If a comment is on a deleted line, its 'rightFileStart' is null.
            let posInfo = props.side === "original" ? context.leftFileStart : context.rightFileStart;

            // Simple heuristic: if we are on modified side but there's no right position, 
            // and it's a deleted line (left position exists), show it if it's unified view.
            // But wait, the line numbers in unified view document correspond to the 'modified' side.
            // Deleted lines are virtual, so we can't easily place them using line numbering.
            // For now, let's just make sure we don't skip line-based comments if they fit the current side.

            if (!posInfo) continue;

            try {
                if (posInfo.line > state.doc.lines) continue;
                const line = state.doc.line(posInfo.line);
                decorations.push(Decoration.widget({
                    widget: new CommentThreadWidget(thread, props),
                    side: 1,
                    block: true
                }).range(line.to));
            } catch (e) {
                console.warn("Failed to place comment thread at line", posInfo.line);
            }
        }

        // 2. Drafts
        for (const draft of drafts) {
            decorations.push(Decoration.widget({
                widget: new CommentDraftWidget(draft, props),
                side: 1,
                block: true
            }).range(draft.to));
        }

        decorations.sort((a, b) => a.from - b.from);
        return Decoration.set(decorations);
    });


    // 2. Selection Tooltip (The "Comment" button)
    const selectionTooltipField = StateField.define<Tooltip | null>({
        create: () => null,
        update(tooltip, tr) {
            if (!tr.selection && !tr.docChanged) return tooltip;
            const selection = tr.state.selection.main;
            if (selection.empty) return null;

            return {
                pos: selection.to,
                above: true,
                strictSide: true,
                create(view) {
                    const dom = document.createElement("div");
                    dom.className = "cm-comment-tooltip z-50";
                    const root = createRoot(dom);
                    root.render(
                        <button
                            className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md px-2 py-1 text-xs font-medium shadow-lg transition-all animate-in fade-in zoom-in-95 cursor-pointer border border-blue-400/20"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const from = selection.from;
                                const to = selection.to;

                                const startLine = view.state.doc.lineAt(from);

                                // Standardize offsets
                                const startOffset = from - startLine.from + 1;

                                const draft: CommentDraft = {
                                    id: Math.random().toString(36).substring(7),
                                    from,
                                    to,
                                    side: props.side,
                                    originalLine: startLine.number,
                                    originalOffset: startOffset,
                                    modifiedLine: startLine.number,
                                    modifiedOffset: startOffset
                                };

                                view.dispatch({
                                    effects: addDraftEffect.of(draft)
                                });
                            }}
                        >
                            <MessageSquarePlus className="w-3 h-3" />
                            <span>Comment</span>
                        </button>
                    );
                    return { dom };
                }
            };
        },
        provide: f => showTooltip.from(f)
    });

    return [
        draftStateField,
        commentDecorations,
        selectionTooltipField
    ];
};
