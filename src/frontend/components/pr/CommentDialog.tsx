import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Send, X, Sparkles } from "lucide-react";
import { runAutomation } from "../../api/automation";

interface CommentDialogProps {
    draftKey: string;
    initialValue?: string;
    onSubmit: (content: string) => Promise<void>;
    onCancel: () => void;
    position?: { x: number; y: number } | null;
    llmContext?: {
        projectName: string;
        repoName: string;
        sourceBranch: string;
        filePath: string;
        startLine: number;
        endLine: number;
    } | null;
}

export const CommentDialog: React.FC<CommentDialogProps> = ({
    draftKey,
    initialValue = "",
    onSubmit,
    onCancel,
    position,
    llmContext
}) => {
    const [content, setContent] = useState(initialValue);
    const [isPreview, setIsPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isApplyingFix, setIsApplyingFix] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
            setContent(saved);
        }
    }, [draftKey]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setContent(newVal);
        localStorage.setItem(draftKey, newVal);
    };

    const handleSubmit = async () => {
        if (!content.trim()) return;
        setIsSubmitting(true);
        try {
            await onSubmit(content);
            localStorage.removeItem(draftKey);
        } catch (error) {
            console.error("Failed to submit comment", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApplyFix = async () => {
        if (!content.trim() || !llmContext) return;
        setIsApplyingFix(true);
        try {
            const context = {
                file_path: llmContext.filePath.startsWith('/') ? llmContext.filePath.substring(1) : llmContext.filePath,
                branch: llmContext.sourceBranch,
                comment: content,
                code_context: `File: ${llmContext.filePath}, Lines: ${llmContext.startLine}-${llmContext.endLine}`,
                projectName: llmContext.projectName,
                repoName: llmContext.repoName
            };

            const res = await runAutomation("apply_fix", context);

            if (res.success) {
                localStorage.removeItem(draftKey);
                onCancel();
            } else {
                alert("Failed to apply fix: " + (res.error || "Unknown error"));
            }
        } catch (err: any) {
            console.error(err);
            alert("Failed to apply fix: " + err.message);
        } finally {
            setIsApplyingFix(false);
        }
    };

    return (
        <div
            className="flex flex-col w-[400px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 z-50 pointer-events-auto"
            style={position ? { position: 'fixed', left: position.x, top: position.y } : undefined}
            onMouseDown={(e) => e.stopPropagation()} // Prevent editor selection loss
        >
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 border-b border-zinc-700/50">
                <div className="flex space-x-1">
                    <button
                        onClick={() => setIsPreview(false)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${!isPreview ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                        Write
                    </button>
                    <button
                        onClick={() => setIsPreview(true)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${isPreview ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                        Preview
                    </button>
                </div>
                <button
                    onClick={onCancel}
                    className="p-1 hover:bg-zinc-700/50 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="p-3">
                {isPreview ? (
                    <div className="prose prose-sm prose-invert min-h-[120px] max-h-[300px] overflow-y-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content || "*Nothing to preview*"}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <textarea
                        value={content}
                        onChange={handleChange}
                        placeholder="Leave a comment..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[120px] resize-y placeholder-zinc-600 font-sans"
                        autoFocus
                    />
                )}
            </div>

            <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/30 border-t border-zinc-700/50">
                <span className="text-[10px] text-zinc-500 italic">
                    {content ? "Draft saved" : "No draft saved"}
                </span>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting || isApplyingFix}
                        className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    {llmContext && (
                        <button
                            onClick={handleApplyFix}
                            disabled={isApplyingFix || isSubmitting || !content.trim()}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-purple-400 rounded-md text-xs font-medium transition-all border border-purple-500/30"
                            title="Apply fix with AI"
                        >
                            {isApplyingFix ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span>Apply Fix</span>
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isApplyingFix || !content.trim()}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-xs font-medium transition-all shadow-sm"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Comment</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
