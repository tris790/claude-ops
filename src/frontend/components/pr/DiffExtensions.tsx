import React from "react";
import { createRoot } from "react-dom/client";
import { StateField, StateEffect } from "@codemirror/state";
import { EditorView, Decoration, WidgetType, showTooltip, type Tooltip, type DecorationSet } from "@codemirror/view";
import { MessageSquarePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CommentDialog } from "./CommentDialog";
import { createPullRequestThread, updatePullRequestComment, deletePullRequestComment, updatePullRequestThread, addPullRequestComment } from "../../api/prs";
import { Edit2, Trash2, CheckCircle2, RotateCcw, Reply, MoreVertical, ChevronDown, ChevronRight } from "lucide-react";

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
    const isThreadResolved = thread.status === 2 || thread.status === 4;
    const [isCollapsed, setIsCollapsed] = React.useState(isThreadResolved);
    const [showStatusMenu, setShowStatusMenu] = React.useState(false);

    const statuses = [
        { id: 1, label: "Active", color: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" },
        { id: 2, label: "Resolved", color: "bg-green-500/20 text-green-400 hover:bg-green-500/30" },
        { id: 3, label: "Won't Fix", color: "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700/70" },
        { id: 4, label: "Closed", color: "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700/70" },
        { id: 5, label: "By Design", color: "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" },
        { id: 6, label: "Pending", color: "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" },
    ] as const;

    const currentStatus = statuses.find(s => s.id === (thread.status || 1)) ?? statuses[0];

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

    const handleUpdateThreadStatus = async (status: number) => {
        try {
            await updatePullRequestThread(props.pullRequestId!, props.repoId, thread.id, status);
            setShowStatusMenu(false);
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

    return (
        <div className="p-2 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
                    >
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowStatusMenu(!showStatusMenu)}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${currentStatus.color}`}
                        >
                            {currentStatus.label}
                            <ChevronDown className="w-2.5 h-2.5" />
                        </button>

                        {showStatusMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowStatusMenu(false)}
                                />
                                <div className="absolute top-full left-0 mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1">
                                    {statuses.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleUpdateThreadStatus(s.id)}
                                            className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${s.id === thread.status ? 'bg-white/10 ' + s.color : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    {isCollapsed && (
                        <span className="text-[11px] text-zinc-500 truncate max-w-[300px]">
                            {thread.comments[0]?.author?.displayName}: {thread.comments[0]?.content.substring(0, 60)}
                            {thread.comments[0]?.content.length > 60 ? "..." : ""}
                            {thread.comments.length > 1 ? ` (+${thread.comments.length - 1} replies)` : ""}
                        </span>
                    )}
                </div>
                <div className="flex items-center space-x-1">
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
                                <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 shrink-0 uppercase font-bold border border-zinc-700 shadow-sm">
                                    {comment.author?.displayName?.[0] || "?"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between mb-0.5">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-semibold text-zinc-200">{comment.author?.displayName}</span>
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-tight">{new Date(comment.publishedDate).toLocaleString()}</span>
                                        </div>
                                        {isAuthor && (
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditingCommentId(comment.id)}
                                                    className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-blue-400"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                    className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[13px] text-zinc-300 prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {!isReplying ? (
                        <button
                            onClick={() => setIsReplying(true)}
                            className="flex items-center space-x-1.5 text-[11px] font-medium text-zinc-500 hover:text-blue-400 transition-colors pl-9"
                        >
                            <Reply className="w-3 h-3" />
                            <span>Reply...</span>
                        </button>
                    ) : (
                        <div className="pl-9 mt-2">
                            <CommentDialog
                                draftKey={`reply_${thread.id}`}
                                onSubmit={handleReply}
                                onCancel={() => setIsReplying(false)}
                            />
                        </div>
                    )}
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
        dom.className = "cm-comment-thread-widget border-l-2 border-blue-500 bg-zinc-900/40 my-2 rounded-r-md overflow-hidden animate-in slide-in-from-left-2 duration-200 shadow-lg";
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
