import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorState, StateField } from "@codemirror/state";
import { EditorView, lineNumbers, hoverTooltip, drawSelection, keymap, showTooltip, type Tooltip, Decoration, tooltips as cmTooltips } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { MergeView, unifiedMergeView } from "@codemirror/merge";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown as mdLang } from "@codemirror/lang-markdown";
import { linter, type Diagnostic, setDiagnostics } from "@codemirror/lint";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getEditorTheme } from "../../styles/code-themes";
import { getFileContent } from "../../api/repos";
import { Loader2, MessageSquarePlus, CheckSquare, Square } from "lucide-react";
import { LSPClient } from "../../utils/lsp-client";
import { getHighlighter } from "../../utils/shiki";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { createCommentSystem } from "./DiffExtensions";
import { handleLSPDefinition } from "../../features/lsp/navigation";
import { type LSPLocation } from "../../components/lsp/ReferencesPanel";

interface DiffViewerProps {
    repoId: string;
    filePath: string;
    originalVersion: string; // usually the target branch or base commit
    modifiedVersion: string; // usually the source branch or head commit
    projectName?: string;
    repoName?: string;
    isCloned?: boolean;
    pullRequestId?: string;
    isReviewed: boolean;
    onToggleReviewed: () => void;
    threads?: any[];
    onCommentPosted?: () => void;
    scrollToLine?: number | null;
    modifiedFiles?: string[];
    onFindReferences?: (refs: LSPLocation[], isLoading: boolean) => void;
}

type DiffMode = "side-by-side" | "unified" | "new-only";

const DEFAULT_SPLIT_RATIO = 0.5;
const STORAGE_KEY_SPLIT = "claude-ops-diff-split";


export const DiffViewer: React.FC<DiffViewerProps> = ({
    repoId,
    filePath,
    originalVersion,
    modifiedVersion,
    projectName,
    repoName,
    isCloned,
    pullRequestId,
    isReviewed,
    onToggleReviewed,
    threads,
    onCommentPosted,
    scrollToLine,
    modifiedFiles,
    onFindReferences
}) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MergeView | null>(null);
    const editorRef = useRef<EditorView | null>(null);
    const lspRef = useRef<LSPClient | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lspStatus, setLspStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
    const [diffMode, setDiffMode] = useState<DiffMode>("side-by-side");
    const [splitRatio, setSplitRatio] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_SPLIT);
        return saved ? parseFloat(saved) : DEFAULT_SPLIT_RATIO;
    });
    const [isResizing, setIsResizing] = useState(false);


    const [contents, setContents] = useState<{ original: string; modified: string } | null>(null);

    // Global keyboard listener for F12
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F12") {
                e.preventDefault();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // LSP Connection Effect
    useEffect(() => {
        if (!isCloned || !projectName || !repoName || !filePath || loading || !contents) {
            setLspStatus("disconnected");
            return;
        }

        const ext = filePath.split('.').pop()?.toLowerCase();
        let language = "";
        if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') language = 'typescript';
        else if (ext === 'go') language = 'go';
        else if (ext === 'py') language = 'python';

        if (!language) return;

        setLspStatus("connecting");
        const client = new LSPClient(projectName!, repoName!, language);
        lspRef.current = client;

        client.connect().then(() => {
            setLspStatus("connected");

            const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;

            client.sendNotification('textDocument/didOpen', {
                textDocument: {
                    uri: `file:///original${normalizedPath}`,
                    languageId: language,
                    version: 1,
                    text: contents!.original
                }
            });

            client.sendNotification('textDocument/didOpen', {
                textDocument: {
                    uri: `file:///modified${normalizedPath}`,
                    languageId: language,
                    version: 1,
                    text: contents!.modified
                }
            });
        }).catch(err => {
            console.error("[DiffViewer] LSP Connection Failed", err);
            setLspStatus("disconnected");
        });

        return () => {
            client.disconnect();
            lspRef.current = null;
            setLspStatus("disconnected");
        };
    }, [filePath, projectName, repoName, isCloned, loading, contents]);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);

        async function loadContents() {
            try {
                const [original, modified] = await Promise.all([
                    getFileContent(repoId, filePath, originalVersion, "commit").catch(() => ""),
                    getFileContent(repoId, filePath, modifiedVersion, "commit").catch(() => ""),
                ]);

                if (!isMounted) return;
                setContents({ original, modified });
                setLoading(false);
            } catch (err: any) {
                if (!isMounted) return;
                console.error(err);
                setError("Failed to load diff content");
                setLoading(false);
            }
        }

        loadContents();

        return () => {
            isMounted = false;
        };
    }, [repoId, filePath, originalVersion, modifiedVersion]);

    useEffect(() => {
        if (loading || !contents || !containerRef.current) return;

        if (viewRef.current) {
            viewRef.current.destroy();
        }

        const ext = filePath.split('.').pop()?.toLowerCase();
        const getLang = () => {
            switch (ext) {
                case "ts":
                case "tsx":
                case "js":
                case "jsx": return javascript({ typescript: true, jsx: true });
                case "html": return html();
                case "css": return css();
                case "json": return json();
                case "md": return mdLang();
                default: return [];
            }
        };

        // Legacy comment extension removed in favor of createCommentSystem

        const createLSPExtensions = (uri: string) => {
            const hoverExtension = hoverTooltip(async (view, pos, side) => {
                if (!lspRef.current || lspStatus !== 'connected') return null;
                const line = view.state.doc.lineAt(pos);
                const character = pos - line.from;

                try {
                    const result = await lspRef.current.sendRequest("textDocument/hover", {
                        textDocument: { uri },
                        position: { line: line.number - 1, character }
                    });

                    if (!result || !result.contents) return null;

                    let signatureMarkdown = "";
                    let docMarkdown = "";

                    const processMarkedString = (s: any) => {
                        if (typeof s === 'string') return s;
                        if (s.language) return `\`\`\`${s.language}\n${s.value}\n\`\`\``;
                        return s.value || "";
                    };

                    if (Array.isArray(result.contents)) {
                        signatureMarkdown = processMarkedString(result.contents[0]);
                        docMarkdown = result.contents.slice(1).map(processMarkedString).join('\n\n');
                    } else if (result.contents.kind === "markdown") {
                        docMarkdown = result.contents.value;
                    } else {
                        docMarkdown = processMarkedString(result.contents);
                    }

                    if (!signatureMarkdown && !docMarkdown.trim()) return null;

                    return {
                        pos,
                        end: pos,
                        create(view) {
                            const dom = document.createElement("div");
                            dom.className = "cm-lsp-tooltip-container group p-0 max-w-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95";
                            const root = createRoot(dom);

                            const TooltipContent = () => {
                                const [highlighter, setHighlighter] = useState<any>(null);
                                useEffect(() => { getHighlighter().then(setHighlighter); }, []);

                                return (
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {signatureMarkdown && (
                                            <div className="bg-zinc-800/50 px-4 py-2 border-b border-zinc-700/30">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, inline, className, children, ...props }: any) {
                                                            const lang = /language-(\w+)/.exec(className || "")?.[1] || "typescript";
                                                            const code = String(children).replace(/\n$/, "");
                                                            if (!inline && highlighter) {
                                                                const html = highlighter.codeToHtml(code, { lang, theme: 'github-dark' });
                                                                return <div dangerouslySetInnerHTML={{ __html: html }} className="text-xs font-mono" />;
                                                            }
                                                            return <code className="text-xs font-mono text-blue-300 font-bold">{children}</code>;
                                                        }
                                                    }}
                                                >
                                                    {signatureMarkdown}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                        <div className="p-4 prose prose-sm prose-invert max-w-none">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code({ node, inline, className, children, ...props }: any) {
                                                        const match = /language-(\w+)/.exec(className || "");
                                                        const lang = match ? match[1] : "";
                                                        const code = String(children).replace(/\n$/, "");
                                                        if (!inline && lang && highlighter) {
                                                            const html = highlighter.codeToHtml(code, { lang, theme: 'github-dark' });
                                                            return <div className="shiki-tooltip-code rounded overflow-hidden shadow-inner bg-black/20" dangerouslySetInnerHTML={{ __html: html }} />;
                                                        }
                                                        return inline ?
                                                            <code className="bg-zinc-800/80 px-1 py-0.5 rounded text-blue-300 font-mono text-[0.9em]" {...props}>{children}</code> :
                                                            <pre className="bg-zinc-950/50 p-3 rounded-md overflow-x-auto border border-zinc-800/50" {...props}><code className={className}>{children}</code></pre>;
                                                    },
                                                    a({ href, children }: any) {
                                                        const handleClick = (e: React.MouseEvent) => {
                                                            e.preventDefault();
                                                            if (href?.startsWith("file:///")) {
                                                                const dummyLocation = { uri: href, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
                                                                handleLSPDefinition(dummyLocation, {
                                                                    projectName: projectName || "",
                                                                    repoName: repoName || "",
                                                                    pullRequestId: pullRequestId,
                                                                    modifiedFiles: modifiedFiles,
                                                                }, navigate);
                                                            } else if (href) {
                                                                window.open(href, "_blank");
                                                            }
                                                        };
                                                        return (
                                                            <a href={href} onClick={handleClick} className="text-blue-400 hover:underline">
                                                                {children}
                                                            </a>
                                                        );
                                                    }
                                                }}
                                            >
                                                {docMarkdown}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                );
                            };

                            root.render(<TooltipContent />);
                            return { dom, overlap: true };
                        }
                    };
                } catch (e) {
                    return null;
                }
            }, { hoverTime: 300 });

            const handleGoToDefinition = async (view: EditorView) => {
                if (!lspRef.current || lspStatus !== 'connected') return false;
                const pos = view.state.selection.main.head;
                const line = view.state.doc.lineAt(pos);
                const character = pos - line.from;

                try {
                    const result = await lspRef.current.sendRequest("textDocument/definition", {
                        textDocument: { uri },
                        position: { line: line.number - 1, character }
                    });

                    if (!result) return false;

                    return handleLSPDefinition(result, {
                        projectName: projectName || "",
                        repoName: repoName || "",
                        pullRequestId: pullRequestId,
                        modifiedFiles: modifiedFiles,
                    }, navigate);
                } catch (e) {
                    return false;
                }
            };

            const handleFindReferences = async (view: EditorView) => {
                if (!lspRef.current || lspStatus !== 'connected' || !onFindReferences) return false;
                const pos = view.state.selection.main.head;
                const line = view.state.doc.lineAt(pos);
                const character = pos - line.from;

                onFindReferences([], true);
                try {
                    const result = await lspRef.current.sendRequest("textDocument/references", {
                        textDocument: { uri },
                        position: { line: line.number - 1, character },
                        context: { includeDeclaration: true }
                    });
                    onFindReferences(result || [], false);
                    return true;
                } catch (e) {
                    onFindReferences([], false);
                    return false;
                }
            };

            return [
                hoverExtension,
                linter(async () => []),
                keymap.of([
                    { key: "F12", run: (view) => { handleGoToDefinition(view); return true; } },
                    { key: "Shift-F12", run: (view) => { handleFindReferences(view); return true; } }
                ]),
                EditorView.domEventHandlers({
                    mousedown: (event, view) => {
                        if ((event.ctrlKey || event.metaKey) && event.button === 0) {
                            event.preventDefault();
                            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                            if (pos !== null) {
                                view.dispatch({ selection: { anchor: pos } });
                                if (event.shiftKey) {
                                    handleFindReferences(view);
                                } else {
                                    handleGoToDefinition(view);
                                }
                                return true;
                            }
                        }
                        return false;
                    }
                }),
            ];
        };

        const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;

        const baseExtensions = [
            lineNumbers(),
            ...getEditorTheme(true),
            getLang(),
            bracketMatching(),
            drawSelection(),
            history(),
            keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
            ]),
            EditorState.readOnly.of(true),
            cmTooltips({ position: 'fixed', parent: tooltipRef.current || document.body }),
        ];

        // Setup Diagnostics for both panes
        const setupDiagnostics = (target: "a" | "b", uri: string) => {
            if (!lspRef.current || !viewRef.current || diffMode !== "side-by-side") return;
            const view = target === "a" ? viewRef.current.a : viewRef.current.b;
            if (!view) return;

            return lspRef.current.on('textDocument/publishDiagnostics', (params: any) => {
                if (params.uri !== uri) return;
            });
        };

        if (diffMode === "unified") {
            const editorView = new EditorView({
                state: EditorState.create({
                    doc: contents.modified,
                    extensions: [
                        ...baseExtensions,
                        unifiedMergeView({
                            original: contents.original,
                            highlightChanges: true,
                            gutter: true,
                        }),
                        ...createLSPExtensions(`file:///modified${normalizedPath}`),
                        ...createCommentSystem({ repoId, filePath, side: "modified", pullRequestId, threads, onCommentPosted, currentUser: user })
                    ]
                }),
                parent: containerRef.current
            });
            editorRef.current = editorView;
            return () => { editorView.destroy(); editorRef.current = null; };
        }

        if (diffMode === "new-only") {
            const editorView = new EditorView({
                state: EditorState.create({
                    doc: contents.modified,
                    extensions: [
                        ...baseExtensions,
                        ...createLSPExtensions(`file:///modified${normalizedPath}`),
                        ...createCommentSystem({ repoId, filePath, side: "modified", pullRequestId, threads, onCommentPosted, currentUser: user })
                    ]
                }),
                parent: containerRef.current
            });
            editorRef.current = editorView;
            return () => { editorView.destroy(); editorRef.current = null; };
        }

        // Side-by-side (default)
        viewRef.current = new MergeView({
            a: {
                doc: contents.original,
                extensions: [
                    ...baseExtensions,
                    ...createLSPExtensions(`file:///original${normalizedPath}`),
                    ...createCommentSystem({ repoId, filePath, side: "original", pullRequestId, threads, onCommentPosted, currentUser: user })
                ]
            },
            b: {
                doc: contents.modified,
                extensions: [
                    ...baseExtensions,
                    ...createLSPExtensions(`file:///modified${normalizedPath}`),
                    ...createCommentSystem({ repoId, filePath, side: "modified", pullRequestId, threads, onCommentPosted, currentUser: user })
                ]
            },
            parent: containerRef.current,
        });

        const unbindA = setupDiagnostics("a", `file:///original${normalizedPath}`);
        const unbindB = setupDiagnostics("b", `file:///modified${normalizedPath}`);

        return () => {
            unbindA?.();
            unbindB?.();
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
    }, [loading, contents, filePath, lspStatus, diffMode, threads]);

    // Handle Scrolling
    useEffect(() => {
        if (!scrollToLine || loading) return;

        const view = diffMode === "side-by-side" ? viewRef.current?.b : editorRef.current;
        if (!view) return;

        try {
            const line = view.state.doc.line(Math.min(scrollToLine, view.state.doc.lines));
            view.dispatch({
                selection: { anchor: line.from },
                scrollIntoView: true,
                effects: EditorView.scrollIntoView(line.from, { y: 'center' })
            });

            // Highlight the line briefly
            const highlight = Decoration.line({ attributes: { class: "bg-blue-500/20 ring-1 ring-blue-500/50" } });
            const deco = Decoration.set([highlight.range(line.from)]);
            // Since we can't easily add ad-hoc decorations without a StateField, 
            // we'll just rely on the selection/scroll for now.
        } catch (e) {
            console.warn("Failed to scroll to line", scrollToLine);
        }
    }, [scrollToLine, loading, diffMode]);

    // Handle Resizing
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                const clamped = Math.min(Math.max(ratio, 0.02), 0.98);
                setSplitRatio(clamped);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            localStorage.setItem(STORAGE_KEY_SPLIT, splitRatio.toString());
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isResizing, splitRatio]); // Added splitRatio dependency for localStorage save, though ref is better.
    // Actually splitRatio in deps of effect might cause re-bind, but it's fine for mouseUp. 
    // Optimization: Use a ref for current splitRatio in mouseUp? 
    // Strict mode safety: Let's stick to simple deps.



    return (
        <div className="flex flex-col h-full bg-zinc-950 overflow-hidden relative">
            <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
                <div className="flex items-center space-x-3 text-xs">
                    <span className="text-zinc-500 font-mono truncate max-w-[300px]">{filePath}</span>
                    <div className={`flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded border ${lspStatus === 'connected' ? 'border-green-800 bg-green-900/20 text-green-400' :
                        lspStatus === 'connecting' ? 'border-yellow-800 bg-yellow-900/20 text-yellow-400' :
                            'border-zinc-700 bg-zinc-800 text-zinc-500'
                        }`}>
                        <div className={`w-1 h-1 rounded-full ${lspStatus === 'connected' ? 'bg-green-500' :
                            lspStatus === 'connecting' ? 'bg-yellow-500' : 'bg-zinc-500'
                            }`} />
                        <span className="font-medium uppercase tracking-wider">
                            {lspStatus === 'connected' ? 'LSP Ready' : lspStatus === 'connecting' ? 'LSP Connecting' : 'LSP Inactive'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center space-x-1 p-0.5 bg-zinc-950 rounded-md border border-zinc-800">
                    <button
                        onClick={() => setDiffMode("side-by-side")}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${diffMode === "side-by-side" ? "bg-blue-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
                    >
                        Side-by-Side
                    </button>
                    <button
                        onClick={() => setDiffMode("unified")}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${diffMode === "unified" ? "bg-blue-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
                    >
                        Unified
                    </button>
                    <button
                        onClick={() => setDiffMode("new-only")}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${diffMode === "new-only" ? "bg-blue-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
                    >
                        New Code
                    </button>
                </div>
            </div>
            {loading && (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                </div>
            )}
            {error && (
                <div className="flex-1 flex items-center justify-center text-red-500">
                    {error}
                </div>
            )}
            <div
                className={`flex-1 overflow-hidden relative ${loading ? 'hidden' : ''} ${diffMode === 'side-by-side' ? 'resizable-merge-view' : ''}`}
                style={{ "--split-ratio": splitRatio } as React.CSSProperties}
            >
                <div ref={containerRef} className="h-full w-full" />
                {diffMode === 'side-by-side' && !loading && !error && (
                    <div
                        className="absolute top-0 bottom-0 w-1 cursor-col-resize z-[100] hover:bg-blue-500/10 transition-colors group"
                        style={{ left: `calc(${splitRatio * 100}%)`, transform: 'translateX(-50%)' }}
                        onMouseDown={handleMouseDown}
                    >
                        {/* Visual indicator on hover/drag */}
                        <div className={`w-0.5 h-full mx-auto transition-colors ${isResizing ? 'bg-blue-500' : 'bg-blue-500/30 group-hover:bg-blue-500'}`} />
                    </div>
                )}
            </div>

            {/* Tooltip Container - Fixed position to avoid clipping but inside logic */}
            <div ref={tooltipRef} className="fixed inset-0 pointer-events-none z-[9999]" />

            <style>{`
                .cm-mergeView { height: 100% !important; }
                .cm-mergeViewEditor { height: 100% !important; }
                .cm-mergeViewEditors { height: 100% !important; }
                .cm-editor { height: 100% !important; }
                .cm-lsp-tooltip-container { font-family: var(--font-sans); }
                .cm-tooltip { pointer-events: auto !important; } /* Re-enable pointer events for interactions */
                
                /* Resizable Styles */
                .resizable-merge-view .cm-mergeView {
                    display: flex !important;
                    height: 100% !important;
                }
                .resizable-merge-view .cm-mergeViewEditors {
                     display: flex !important;
                     width: 100%;
                     flex: 1;
                     height: 100% !important;
                }
                
                /* Target the wrappers (cm-mergeViewEditor), NOT the internal cm-editor */
                .resizable-merge-view .cm-mergeViewEditors > .cm-mergeViewEditor:nth-child(1) {
                    flex: 0 0 calc(var(--split-ratio) * 100%) !important;
                    width: calc(var(--split-ratio) * 100%) !important;
                    min-width: 20px;
                    max-width: calc(100% - 20px);
                    height: 100% !important;
                }
                
                /* The gutter is usually the 2nd child in DOM, and Right Editor is 3rd (last) */
                .resizable-merge-view .cm-mergeViewEditors > .cm-mergeViewEditor:last-child {
                    flex: 1 !important;
                    width: auto !important;
                    min-width: 20px;
                    height: 100% !important;
                }
                
                /* Ensure the editor instance inside fills the wrapper */
                .resizable-merge-view .cm-mergeViewEditor > .cm-editor {
                    height: 100% !important;
                }
                
                .cm-tooltip {
                    z-index: 9999 !important;
                }

                /* Fix for vertical scrolling in MergeView */
                .cm-scroller { overflow: auto !important; }
            `}</style>
        </div>
    );
};
