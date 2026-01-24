import React, { useEffect, useRef, useState } from "react";
import { getEditorTheme } from "../../styles/code-themes";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection, hoverTooltip, type Tooltip } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import { linter, type Diagnostic, setDiagnostics } from "@codemirror/lint";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getFileContent, type GitItem } from "../../api/repos";
import { LSPClient } from "../../utils/lsp-client";

interface FileViewerProps {
    repoId: string;
    file: GitItem;
    projectName?: string;
    repoName?: string;
    isCloned?: boolean;
}

export const FileViewer: React.FC<FileViewerProps> = ({ repoId, file, projectName, repoName, isCloned }) => {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"code" | "markdown">("code");

    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const lspRef = useRef<LSPClient | null>(null);

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

    // LSP Connection Effect
    useEffect(() => {
        if (!isCloned || !projectName || !repoName || !file.path || viewMode !== "code") {
            return;
        }

        const ext = file.path.split('.').pop()?.toLowerCase();
        let language = "";
        if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') language = 'typescript';
        else if (ext === 'go') language = 'go';
        else if (ext === 'py') language = 'python';

        if (!language) return;

        const client = new LSPClient(projectName, repoName, language);
        lspRef.current = client;

        client.connect().then(() => {
            // Initialize
            // Note: In a real LSP scenario, we send 'initialize' request with capabilities
            // For this phase, we assume the backend handles the lifecycle or is simpler

            // For this MVP, we just notify opened file
            // client.sendNotification('textDocument/didOpen', ...);
        }).catch(err => console.error(err));

        return () => {
            client.disconnect();
            lspRef.current = null;
        };
    }, [repoId, file.path, projectName, repoName, isCloned, viewMode]);


    useEffect(() => {
        if (loading || viewMode !== "code" || !editorRef.current) return;

        // Cleanup previous view
        if (viewRef.current) {
            viewRef.current.destroy();
        }

        const hoverExtension = hoverTooltip(async (view, pos, side) => {
            if (!lspRef.current) return null;
            const line = view.state.doc.lineAt(pos);
            const character = pos - line.from;

            try {
                // Request hover from LSP
                const result = await lspRef.current.sendRequest("textDocument/hover", {
                    textDocument: { uri: `file://${file.path}` }, // Backend needs to map this if needed
                    position: { line: line.number - 1, character }
                });

                if (!result || !result.contents) return null;

                let markdown = "";
                if (typeof result.contents === "string") markdown = result.contents;
                else if (result.contents.kind === "markdown") markdown = result.contents.value;
                else if (Array.isArray(result.contents)) {
                    markdown = result.contents.map((c: any) => typeof c === 'string' ? c : c.value).join('\n');
                } else {
                    markdown = result.contents.value || "";
                }

                if (!markdown) return null;

                return {
                    pos,
                    end: pos, // We could use range from result if available
                    above: true,
                    create(view) {
                        const dom = document.createElement("div");
                        dom.className = "p-2 max-w-sm prose prose-sm prose-invert bg-zinc-900 border border-zinc-700 rounded shadow-xl";
                        // Basic markdown rendering or just text
                        dom.textContent = markdown;
                        // Note: For full markdown we'd need a parser, but textContent is safe for now
                        return { dom };
                    }
                };
            } catch (e) {
                console.error(e);
                return null;
            }
        });

        const getExtensions = () => {
            const ext = file.path.split('.').pop()?.toLowerCase();
            const extensions = [
                lineNumbers(),
                history(),
                drawSelection(),
                bracketMatching(),
                ...getEditorTheme(true),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                EditorState.readOnly.of(true),
                hoverExtension,
                linter(async (view) => {
                    // This is a polling linter, but we want push-based usually.
                    // However, we can use this to hold the diagnostics place.
                    // Or we can rely on `setDiagnostics` dispatch.
                    return [];
                })
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

        // Setup Diagnostics Listener
        if (lspRef.current) {
            lspRef.current.on('textDocument/publishDiagnostics', (params: any) => {
                if (!viewRef.current) return;
                // params.uri matching logic could be added here

                const diagnostics: Diagnostic[] = params.diagnostics.map((d: any) => {
                    const fromLine = view.state.doc.line(d.range.start.line + 1);
                    const toLine = view.state.doc.line(d.range.end.line + 1);
                    const from = Math.min(fromLine.from + d.range.start.character, fromLine.to);
                    const to = Math.min(toLine.from + d.range.end.character, toLine.to);

                    return {
                        from,
                        to,
                        severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info",
                        message: d.message,
                        source: d.source
                    };
                });

                view.dispatch(setDiagnostics(view.state, diagnostics));
            });
        }

        return () => {
            view.destroy();
        };
    }, [content, loading, viewMode, file.path]); // Added file.path dependency to safely recreate view on file switch

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
