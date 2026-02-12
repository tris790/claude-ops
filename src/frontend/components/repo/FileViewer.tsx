import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
import { getLspInstallJob, getLspStatus, startLspInstall } from "../../api/lsp";
import { LSPClient } from "../../utils/lsp-client";
import { useNavigate } from "react-router-dom";
import { getHighlighter } from "../../utils/shiki";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { csharp } from "@replit/codemirror-lang-csharp";
import { handleLSPDefinition } from "../../features/lsp/navigation";
import { getLspLanguageFromPath } from "../../features/lsp/language-map";
import { type LSPLocation } from "../../components/lsp/ReferencesPanel";
import { highlightSelectionMatches } from "@codemirror/search";
import { Loader2, Wrench } from "lucide-react";

interface FileViewerProps {
    repoId: string;
    file: GitItem;
    projectName?: string;
    repoName?: string;
    isCloned?: boolean;
    branch?: string;
    scrollToLine?: number | null;
    onFindReferences?: (refs: LSPLocation[], isLoading: boolean) => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({ repoId, file, projectName, repoName, isCloned, branch = "main", scrollToLine, onFindReferences }) => {
    const navigate = useNavigate();
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"code" | "markdown">("code");
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains("dark"));

    const [lspStatus, setLspStatus] = useState<"disconnected" | "checking" | "missing" | "installing" | "connecting" | "connected" | "error">("disconnected");
    const [lspMessage, setLspMessage] = useState<string | null>(null);
    const [lspCanInstall, setLspCanInstall] = useState(false);
    const [lspRefreshNonce, setLspRefreshNonce] = useState(0);

    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const lspRef = useRef<LSPClient | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isMarkdown = file.path.toLowerCase().endsWith(".md");
    const lspLanguage = getLspLanguageFromPath(file.path);

    // Listen for dark mode changes
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "class"
                ) {
                    setIsDarkMode(document.documentElement.classList.contains("dark"));
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

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
        getFileContent(repoId, file.path, branch)
            .then(data => {
                setContent(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Failed to load file content");
                setLoading(false);
            });
    }, [repoId, file.path, branch]);

    const handleInstallLsp = async () => {
        if (!projectName || !repoName || !lspLanguage || !lspCanInstall) return;

        setLspStatus("installing");
        setLspMessage(`Installing ${lspLanguage} language server...`);

        try {
            const { jobId } = await startLspInstall(projectName, repoName, [lspLanguage]);

            for (let attempt = 0; attempt < 600; attempt++) {
                const job = await getLspInstallJob(jobId);
                const runningStep = job.steps.find((step) => step.status === "running");
                const pendingStep = job.steps.find((step) => step.status === "pending");
                const currentStep = runningStep || pendingStep || null;

                if (currentStep) {
                    setLspMessage(`${currentStep.language}: ${currentStep.message}`);
                }

                if (job.status === "completed") {
                    setLspMessage("LSP installation complete");
                    setLspRefreshNonce((value) => value + 1);
                    return;
                }

                if (job.status === "failed") {
                    setLspStatus("error");
                    setLspMessage(job.error || "LSP installation failed");
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            setLspStatus("error");
            setLspMessage("LSP installation timed out");
        } catch (installError) {
            setLspStatus("error");
            setLspMessage(installError instanceof Error ? installError.message : "LSP installation failed");
        }
    };

    // LSP Connection Effect
    useEffect(() => {
        let cancelled = false;
        let detachLogListener: (() => void) | null = null;
        console.log("[FileViewer] LSP Effect Triggered", { isCloned, projectName, repoName, path: file.path, viewMode, loading, lspLanguage });

        if (lspRef.current) {
            lspRef.current.disconnect();
            lspRef.current = null;
        }

        if (!isCloned || !projectName || !repoName || !file.path || viewMode !== "code" || loading || !lspLanguage) {
            setLspStatus("disconnected");
            setLspMessage(null);
            setLspCanInstall(false);
            return () => {
                cancelled = true;
            };
        }

        const connect = async () => {
            setLspStatus("checking");
            setLspMessage(null);

            try {
                const status = await getLspStatus(projectName, repoName, lspLanguage);
                if (cancelled) return;
                setLspCanInstall(status.canInstall);

                if (!status.installed) {
                    setLspStatus("missing");
                    setLspMessage(status.missingReason || status.installUnavailableReason || "Language server is not installed");
                    return;
                }

                setLspMessage(null);
            } catch (statusError) {
                if (cancelled) return;
                setLspStatus("error");
                setLspCanInstall(false);
                setLspMessage(statusError instanceof Error ? statusError.message : "Failed to check LSP status");
                return;
            }

            const client = new LSPClient(projectName, repoName, lspLanguage);
            lspRef.current = client;
            setLspStatus("connecting");

            try {
                await client.connect();
                if (cancelled) {
                    client.disconnect();
                    return;
                }

                setLspStatus("connected");
                detachLogListener = client.on("window/logMessage", (params: any) => {
                    const message = typeof params?.message === "string" ? params.message : "";
                    if (!message) return;
                    if (typeof params?.type === "number" && params.type <= 1) {
                        setLspStatus("error");
                        setLspMessage(message);
                    }
                });

                const normalizedPath = file.path.startsWith("/") ? file.path : `/${file.path}`;
                client.sendNotification("textDocument/didOpen", {
                    textDocument: {
                        uri: `file://${normalizedPath}`,
                        languageId: lspLanguage,
                        version: 1,
                        text: content,
                    },
                });
            } catch (connectError) {
                if (cancelled) return;
                console.error("[FileViewer] LSP Connection Failed", connectError);
                setLspStatus("error");
                setLspMessage(connectError instanceof Error ? connectError.message : "Failed to connect to language server");
            }
        };

        void connect();

        return () => {
            cancelled = true;
            detachLogListener?.();
            if (lspRef.current) {
                lspRef.current.disconnect();
                lspRef.current = null;
            }
        };
    }, [repoId, file.path, projectName, repoName, isCloned, viewMode, loading, lspLanguage, lspRefreshNonce]);


    useEffect(() => {
        if (loading || viewMode !== "code" || !editorRef.current) return;

        // Cleanup previous view
        if (viewRef.current) {
            viewRef.current.destroy();
        }

        const hoverExtension = hoverTooltip((view, pos, side) => {
            if (!lspRef.current || lspStatus !== "connected") return null;
            const line = view.state.doc.lineAt(pos);
            const character = pos - line.from;

            return new Promise((resolve) => {
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                }

                hoverTimeoutRef.current = setTimeout(async () => {
                    if (!lspRef.current || lspStatus !== "connected") {
                        resolve(null);
                        return;
                    }

                    try {
                        const normalizedPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
                        const result = await lspRef.current.sendRequest("textDocument/hover", {
                            textDocument: { uri: `file://${normalizedPath}` },
                            position: { line: line.number - 1, character }
                        });

                        if (!result || !result.contents) {
                            resolve(null);
                            return;
                        }

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

                        if (!signatureMarkdown && !docMarkdown.trim()) {
                            resolve(null);
                            return;
                        }

                        resolve({
                            pos,
                            end: pos,
                            above: true,
                            create(view) {
                                const dom = document.createElement("div");
                                dom.className = "cm-lsp-tooltip-container group p-0 max-w-2xl bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700/50 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95";
                                const root = createRoot(dom);
                                // ... TooltipContent implementation ...
                                // Since TooltipContent refers to closure variables like signatureMarkdown, docMarkdown, file, etc.
                                // We need to inline it or ensure it has access.
                                // In the Replace logic, I must provide the FULL content if I replace the start.
                                // It's safer to just replace the logic up to the `create` or `return` if possible, but the `try/catch` wraps it all.

                                // Actually, I can just replace the wrapper and return the object.
                                // But `TooltipContent` is inside.

                                // Let's reimplement the whole TooltipContent inside the replacement string to be safe and complete.

                                const TooltipContent = () => {
                                    const [highlighter, setHighlighter] = useState<any>(null);
                                    const [definition, setDefinition] = useState<{ path: string, uri: string } | null>(null);
                                    const isDark = document.documentElement.classList.contains("dark");

                                    useEffect(() => {
                                        getHighlighter().then(setHighlighter);

                                        if (lspRef.current) {
                                            const normalizedPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
                                            const line = view.state.doc.lineAt(pos);
                                            const character = pos - line.from;

                                            lspRef.current.sendRequest("textDocument/definition", {
                                                textDocument: { uri: `file://${normalizedPath}` },
                                                position: { line: line.number - 1, character }
                                            }).then(result => {
                                                if (!result) return;
                                                const loc = Array.isArray(result) ? result[0] : result;
                                                if (loc) {
                                                    const uri = 'uri' in loc ? loc.uri : (loc as any).targetUri;
                                                    if (uri.startsWith('file:///')) {
                                                        setDefinition({
                                                            uri,
                                                            path: uri.slice(8)
                                                        });
                                                    }
                                                }
                                            }).catch(console.error);
                                        }
                                    }, []);

                                    return (
                                        <div className="max-h-[400px] overflow-y-auto">
                                            {definition && (
                                                <div className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700/30 flex items-center space-x-1 text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
                                                    <span className="opacity-50">@</span>
                                                    <button
                                                        onClick={() => {
                                                            const targetURL = `/repos/${projectName}/${repoName}/blob/${branch}/${definition.path}`;
                                                            navigate(targetURL);
                                                        }}
                                                        className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition-colors truncate max-w-[300px]"
                                                        title={definition.path}
                                                    >
                                                        {definition.path.split('/').pop()}
                                                    </button>
                                                    <span className="opacity-30 px-1">›</span>
                                                    <span className="text-zinc-500 truncate">{definition.path}</span>
                                                </div>
                                            )}
                                            {signatureMarkdown && (
                                                <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700/30">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            code({ node, inline, className, children, ...props }: any) {
                                                                const lang = /language-(\w+)/.exec(className || "")?.[1] || "typescript";
                                                                const code = String(children).replace(/\n$/, "");
                                                                if (!inline && highlighter) {
                                                                    const html = highlighter.codeToHtml(code, { lang, theme: "github-dark" });
                                                                    const htmlAdaptive = highlighter.codeToHtml(code, { lang, theme: isDark ? 'github-dark' : 'github-light' });
                                                                    return <div dangerouslySetInnerHTML={{ __html: htmlAdaptive }} className="text-xs font-mono" />;
                                                                }
                                                                return <code className="text-xs font-mono text-blue-600 dark:text-blue-300 font-bold">{children}</code>;
                                                            }
                                                        }}
                                                    >
                                                        {signatureMarkdown}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                            <div className="p-4 prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:my-2 prose-pre:my-2 prose-headings:text-zinc-900 dark:prose-headings:text-zinc-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, inline, className, children, ...props }: any) {
                                                            const match = /language-(\w+)/.exec(className || "");
                                                            const lang = match ? match[1] : "";
                                                            const code = String(children).replace(/\n$/, "");

                                                            if (!inline && lang && highlighter) {
                                                                const html = highlighter.codeToHtml(code, {
                                                                    lang: lang,
                                                                    theme: isDark ? 'github-dark' : 'github-light'
                                                                });
                                                                return <div className="shiki-tooltip-code rounded overflow-hidden shadow-inner bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800/50" dangerouslySetInnerHTML={{ __html: html }} />;
                                                            }

                                                            return inline ?
                                                                <code className="bg-zinc-100 dark:bg-zinc-800/80 px-1 py-0.5 rounded text-blue-600 dark:text-blue-300 font-mono text-[0.9em]" {...props}>{children}</code> :
                                                                <pre className="bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-md overflow-x-auto border border-zinc-200 dark:border-zinc-800/50" {...props}><code className={className}>{children}</code></pre>;
                                                        },
                                                        a({ href, children }: any) {
                                                            const handleClick = (e: React.MouseEvent) => {
                                                                e.preventDefault();
                                                                if (href?.startsWith("file:///")) {
                                                                    let targetPath = href.slice(8);
                                                                    if (targetPath.startsWith("original/")) targetPath = targetPath.slice(9);
                                                                    else if (targetPath.startsWith("modified/")) targetPath = targetPath.slice(9);
                                                                    if (!targetPath.startsWith("/")) targetPath = "/" + targetPath;

                                                                    navigate(`/repos/${projectName}/${repoName}/blob/${branch}${targetPath}`);
                                                                } else if (href) {
                                                                    window.open(href, "_blank");
                                                                }
                                                            };
                                                            return (
                                                                <a href={href} onClick={handleClick} className="text-blue-500 dark:text-blue-400 hover:underline">
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
                        });
                    } catch (e) {
                        console.error("[LSP] Hover request failed", e);
                        resolve(null);
                    }
                }, 200);
            });
        }, { hoverTime: 300 });

        const handleGoToDefinition = async (view: EditorView) => {
            if (!lspRef.current || lspStatus !== "connected") return false;
            const pos = view.state.selection.main.head;
            const line = view.state.doc.lineAt(pos);
            const character = pos - line.from;

            try {
                const normalizedPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
                const result = await lspRef.current.sendRequest("textDocument/definition", {
                    textDocument: { uri: `file://${normalizedPath}` },
                    position: { line: line.number - 1, character }
                });

                if (!result) return false;

                return handleLSPDefinition(result, {
                    projectName: projectName || "",
                    repoName: repoName || "",
                    branch: branch
                }, navigate);
            } catch (e) {
                console.error("[LSP] Definition request failed", e);
                return false;
            }
        };

        const handleFindReferences = async (view: EditorView) => {
            if (!lspRef.current || lspStatus !== "connected" || !onFindReferences) return false;
            const pos = view.state.selection.main.head;
            const line = view.state.doc.lineAt(pos);
            const character = pos - line.from;

            onFindReferences([], true);
            try {
                const normalizedPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
                const result = await lspRef.current.sendRequest("textDocument/references", {
                    textDocument: { uri: `file://${normalizedPath}` },
                    position: { line: line.number - 1, character },
                    context: { includeDeclaration: true }
                });
                onFindReferences(result || [], false);
                return true;
            } catch (e) {
                onFindReferences([], false);
                console.error("[LSP] References request failed", e);
                return false;
            }
        };

        const getExtensions = () => {
            const ext = file.path.split('.').pop()?.toLowerCase();
            const extensions = [
                lineNumbers(),
                history(),
                drawSelection(),
                bracketMatching(),
                ...getEditorTheme(isDarkMode),
                keymap.of([
                    ...defaultKeymap,
                    ...historyKeymap,
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
                EditorState.readOnly.of(true),
                highlightSelectionMatches({ highlightWordAroundCursor: true }),
                hoverExtension,
                linter(async (view) => {
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
                case "cs":
                    extensions.push(csharp());
                    break;
                case "c":
                case "h":
                case "cpp":
                case "hpp":
                case "cc":
                    extensions.push(cpp());
                    break;
                case "go":
                    extensions.push(go());
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
        if (lspRef.current && lspStatus === "connected") {
            lspRef.current.on('textDocument/publishDiagnostics', (params: any) => {
                console.log("[LSP] Received Diagnostics", params);
                if (!viewRef.current) return;
                // params.uri matching logic could be added here

                // Diagnostics disabled per user request
                /*
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
                */
            });
        }

        return () => {
            view.destroy();
        };
    }, [content, loading, viewMode, file.path, lspStatus, isDarkMode]); // Added isDarkMode to re-bind theme

    // Handle Scrolling
    useEffect(() => {
        if (!scrollToLine || loading || viewMode !== "code") return;
        if (!viewRef.current) return;

        try {
            const view = viewRef.current;
            const lineCount = view.state.doc.lines;
            const targetLine = Math.min(scrollToLine, lineCount);
            const line = view.state.doc.line(targetLine);

            view.dispatch({
                selection: { anchor: line.from },
                scrollIntoView: true,
                effects: EditorView.scrollIntoView(line.from, { y: 'center' })
            });
        } catch (e) {
            console.warn("Failed to scroll to line", scrollToLine, e);
        }
    }, [scrollToLine, loading, viewMode]);

    const LSP_STATUS_LABELS: Record<typeof lspStatus, string> = {
        connected: "LSP Ready",
        connecting: "LSP Connecting",
        checking: "LSP Checking",
        installing: "LSP Installing",
        missing: "LSP Missing",
        error: "LSP Error",
        disconnected: "LSP Inactive",
    };

    const LSP_STATUS_CLASSES: Record<typeof lspStatus, string> = {
        connected: "border-green-200 dark:border-green-800 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400",
        connecting: "border-yellow-200 dark:border-yellow-800 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
        checking: "border-yellow-200 dark:border-yellow-800 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
        installing: "border-blue-200 dark:border-blue-800 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
        missing: "border-rose-200 dark:border-rose-800 bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
        error: "border-rose-200 dark:border-rose-800 bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
        disconnected: "border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
    };

    const LSP_DOT_CLASSES: Record<typeof lspStatus, string> = {
        connected: "bg-green-500",
        connecting: "bg-yellow-500",
        checking: "bg-yellow-500",
        installing: "bg-blue-500",
        missing: "bg-rose-500",
        error: "bg-rose-500",
        disconnected: "bg-zinc-500",
    };

    const lspStatusLabel = LSP_STATUS_LABELS[lspStatus];
    const lspStatusClass = LSP_STATUS_CLASSES[lspStatus];
    const lspDotClass = LSP_DOT_CLASSES[lspStatus];

    const canShowInstallButton =
        Boolean(isCloned && projectName && repoName && lspLanguage && lspCanInstall && (lspStatus === "missing" || lspStatus === "error" || lspStatus === "installing"));

    if (loading) return <div className="p-8 text-center text-zinc-500">Loading content...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center space-x-2">
                    {viewMode === "code" && (
                        <>
                            <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded border ${lspStatusClass}`}>
                                {lspStatus === "installing"
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <div className={`w-1.5 h-1.5 rounded-full ${lspDotClass}`} />}
                                <span>{lspStatusLabel}</span>
                            </div>
                            {canShowInstallButton && (
                                <button
                                    type="button"
                                    onClick={() => { void handleInstallLsp(); }}
                                    disabled={lspStatus === "installing"}
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200/70 dark:hover:bg-blue-900/40 disabled:opacity-60"
                                >
                                    {lspStatus === "installing"
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <Wrench className="w-3 h-3" />}
                                    <span>Install LSP</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
                <div className="flex space-x-2 bg-zinc-200 dark:bg-zinc-800 rounded p-1">
                    <button
                        onClick={() => setViewMode("markdown")}
                        className={`px-3 py-1 text-xs rounded ${viewMode === "markdown" ? "bg-blue-600 text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
                    >
                        Preview
                    </button>
                    <button
                        onClick={() => setViewMode("code")}
                        className={`px-3 py-1 text-xs rounded ${viewMode === "code" ? "bg-blue-600 text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
                    >
                        Source
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {viewMode === "code" ? (
                    <div className="h-full flex flex-col">
                        {lspMessage && (lspStatus === "missing" || lspStatus === "installing" || lspStatus === "error") && (
                            <div className="px-3 py-2 text-xs border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900">
                                {lspMessage}
                            </div>
                        )}
                        <div ref={editorRef} className="h-full text-base" />
                    </div>
                ) : (
                    <div className="prose prose-zinc dark:prose-invert max-w-none p-8">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
            <style>{`
                .cm-editor { height: 100% !important; }
                .cm-scroller { overflow: auto !important; }
                .cm-lsp-tooltip-container { font-family: var(--font-sans); }
                .cm-tooltip { pointer-events: auto !important; z-index: 9999 !important; }
            `}</style>
        </div>
    );
};
