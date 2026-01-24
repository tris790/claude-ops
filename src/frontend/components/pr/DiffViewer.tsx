import React, { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { getEditorTheme } from "../../styles/code-themes";
import { getFileContent } from "../../api/repos";
import { Loader2 } from "lucide-react";

interface DiffViewerProps {
    repoId: string;
    filePath: string;
    originalVersion: string; // usually the target branch or base commit
    modifiedVersion: string; // usually the source branch or head commit
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ repoId, filePath, originalVersion, modifiedVersion }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MergeView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

                if (viewRef.current) {
                    viewRef.current.destroy();
                }

                if (containerRef.current) {
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
                            case "md": return markdown();
                            default: return [];
                        }
                    };

                    const extensions = [
                        lineNumbers(),
                        ...getEditorTheme(true),
                        getLang(),
                        EditorState.readOnly.of(true),
                    ];

                    viewRef.current = new MergeView({
                        a: {
                            doc: original,
                            extensions
                        },
                        b: {
                            doc: modified,
                            extensions
                        },
                        parent: containerRef.current,
                    });
                }
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
            if (viewRef.current) {
                viewRef.current.destroy();
            }
        };
    }, [repoId, filePath, originalVersion, modifiedVersion]);

    return (
        <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
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
            <div ref={containerRef} className={`flex-1 overflow-auto ${loading ? 'hidden' : ''}`} />
        </div>
    );
};
