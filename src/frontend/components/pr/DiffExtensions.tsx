import React from "react";
import { createRoot } from "react-dom/client";
import { StateField, StateEffect } from "@codemirror/state";
import { EditorView, Decoration, WidgetType, showTooltip, type Tooltip } from "@codemirror/view";
import { MessageSquarePlus } from "lucide-react";
import { CommentDialog } from "./CommentDialog";
import { createPullRequestThread } from "../../api/prs";
import { linter, type Diagnostic } from "@codemirror/lint";

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
}

// --- Effects ---

const addDraftEffect = StateEffect.define<CommentDraft>();
const removeDraftEffect = StateEffect.define<string>(); // id

// --- Widget ---

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
        // Position it nicely? The widget will be inserted at the 'to' position.
        // We might want to make it overlay or block. 
        // For now, let's make it a block widget so it pushes content or sits in between?
        // Actually, inline widget at the end of selection is easiest for now, or use an overlay.
        // Let's use absolute positioning relative to the line.

        const root = createRoot(dom);

        const draftKey = `draft_${this.props.pullRequestId}_${this.props.filePath}_${this.draft.side}_${this.draft.originalLine}`;

        const handleSave = async (content: string) => {
            if (!this.props.pullRequestId) {
                alert("Cannot comment: No Pull Request Context");
                return;
            }

            console.log("Saving comment:", content, this.draft);

            // Construct thread context
            // Azure DevOps/Generic Context
            const threadContext = {
                filePath: this.props.filePath,
                rightFileStart: this.draft.side === 'modified' ? { line: this.draft.modifiedLine, offset: this.draft.originalOffset } : undefined,
                rightFileEnd: this.draft.side === 'modified' ? { line: this.draft.modifiedLine, offset: this.draft.originalOffset /* should be range end */ } : undefined,
                leftFileStart: this.draft.side === 'original' ? { line: this.draft.originalLine, offset: this.draft.originalOffset } : undefined,
                leftFileEnd: this.draft.side === 'original' ? { line: this.draft.originalLine, offset: this.draft.originalOffset } : undefined,
            };

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

// --- Extensions ---

export const createCommentSystem = (props: CommentSystemProps) => {

    // Revised Field: Manage Data separate from Decorations
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
        provide: f => EditorView.decorations.from(f, drafts => {
            const widgets = drafts.map(draft => {
                return Decoration.widget({
                    widget: new CommentDraftWidget(draft, props),
                    side: 1,
                    block: true
                }).range(draft.to);
            });
            // Decoration.set expects sorted ranges. If they are not sorted, this will crash or warn.
            // .map produces an array.
            // We should sort them.
            widgets.sort((a, b) => a.from - b.from);
            return Decoration.set(widgets);
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
