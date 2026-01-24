import React, { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getFileContent, type GitItem } from "../../api/repos";

interface FileViewerProps {
    repoId: string;
    file: GitItem;
}

export const FileViewer: React.FC<FileViewerProps> = ({ repoId, file }) => {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"code" | "markdown">("code");

    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    const isMarkdown = file.path.toLowerCase().endsWith(".md");

    useEffect(() => {
        if (isMarkdown) {
            setViewMode("markdown");
        } else {
            setViewMode("code");
        }
    }, [file.path, isMarkdown]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        getFileContent(repoId, file.path)
            .then(data => {
                setContent(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Failed to load file content");
                setLoading(false);
            });
    }, [repoId, file.path]);

    useEffect(() => {
        if (loading || viewMode !== "code" || !editorRef.current) return;

        // Cleanup previous view
        if (viewRef.current) {
            viewRef.current.destroy();
        }

        const getExtensions = () => {
            const ext = file.path.split('.').pop()?.toLowerCase();
            const extensions = [
                lineNumbers(),
                history(),
                drawSelection(),
                bracketMatching(),
                syntaxHighlighting(defaultHighlightStyle),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                EditorState.readOnly.of(true)
            ];

            switch (ext) {
                case "ts":
                case "tsx":
                case "js":
                case "jsx":
                    extensions.push(javascript({ typescript: true, jsx: true }));
                    break;
                case "html":
                    extensions.push(html());
                    break;
                case "css":
                    extensions.push(css());
                    break;
                case "json":
                    extensions.push(json());
                    break;
                case "md":
                    extensions.push(mdLang());
                    break;
            }
            return extensions;
        };

        const state = EditorState.create({
            doc: content,
            extensions: getExtensions(),
        });

        const view = new EditorView({
            state,
            parent: editorRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, [content, loading, viewMode, file.path]);

    if (loading) return <div className="p-8 text-center text-zinc-500">Loading content...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {isMarkdown && (
                <div className="flex items-center justify-end px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                    <div className="flex space-x-2 bg-zinc-800 rounded p-1">
                        <button
                            onClick={() => setViewMode("markdown")}
                            className={`px-3 py-1 text-xs rounded ${viewMode === "markdown" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                        >
                            Preview
                        </button>
                        <button
                            onClick={() => setViewMode("code")}
                            className={`px-3 py-1 text-xs rounded ${viewMode === "code" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                        >
                            Source
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto">
                {viewMode === "code" ? (
                    <div ref={editorRef} className="h-full text-base" />
                ) : (
                    <div className="prose prose-invert max-w-none p-8">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
};
