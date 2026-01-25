import React from "react";
import { createRoot } from "react-dom/client";
import { StateField, StateEffect } from "@codemirror/state";
import { EditorView, Decoration, WidgetType, showTooltip, type Tooltip } from "@codemirror/view";
import { MessageSquarePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CommentDialog } from "./CommentDialog";
import { createPullRequestThread } from "../../api/prs";

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
        root.render(
            <div className="p-3 space-y-4">
                {this.thread.comments.filter((c: any) => c.content).map((comment: any, idx: number) => (
                    <div key={comment.id || idx} className="flex gap-3">
                        <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 shrink-0 uppercase font-bold border border-zinc-700 shadow-sm">
                            {comment.author?.displayName?.[0] || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-zinc-200">{comment.author?.displayName}</span>
                                <span className="text-[9px] text-zinc-500 uppercase tracking-tight">{new Date(comment.publishedDate).toLocaleString()}</span>
                            </div>
                            <div className="text-[13px] text-zinc-300 prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
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
        },
        provide: f => EditorView.decorations.from(f, (drafts) => {
            const decorations: Decoration[] = [];

            // 1. Existing Threads
            const threads = props.threads || [];
            for (const thread of threads) {
                if (thread.isDraft || !thread.threadContext) continue;
                const context = thread.threadContext;

                // Azure uses 1-based line numbers. Ensure path matches.
                // Azure paths often have leading slash, normalize.
                const threadPath = context.filePath?.startsWith('/') ? context.filePath : `/${context.filePath}`;
                const propsPath = props.filePath?.startsWith('/') ? props.filePath : `/${props.filePath}`;

                if (threadPath !== propsPath) continue;

                const posInfo = props.side === "original" ? context.leftFileStart : context.rightFileStart;
                if (!posInfo) continue;

                try {
                    // Check if line exists in current doc
                    const state = f.get(f);
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
        })
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
                                const endLine = view.state.doc.lineAt(to);

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
        selectionTooltipField
    ];
};
