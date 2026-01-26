import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, FileCode, ChevronRight, Loader2, Search } from "lucide-react";
import { getFileContent } from "../../api/repos";

export interface LSPLocation {
    uri: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
}

interface ReferenceItem {
    location: LSPLocation;
    path: string;
    context?: string;
}

interface ReferencesPanelProps {
    references: LSPLocation[];
    repoId: string;
    repoName: string;
    projectName: string;
    onSelect: (location: LSPLocation) => void;
    onClose: () => void;
    isLoading?: boolean;
    initialHeight?: number;
}

export const ReferencesPanel: React.FC<ReferencesPanelProps> = ({
    references,
    repoId,
    repoName,
    projectName,
    onSelect,
    onClose,
    isLoading = false,
    initialHeight = 300
}) => {
    const [height, setHeight] = useState(initialHeight);
    const [isResizing, setIsResizing] = useState(false);
    const [groupedRefs, setGroupedRefs] = useState<Map<string, ReferenceItem[]>>(new Map());
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [loadingContexts, setLoadingContexts] = useState(false);
    const requestRef = useRef<number>(undefined);

    // Group references by file and fetch context
    useEffect(() => {
        const group = new Map<string, ReferenceItem[]>();

        references.forEach(loc => {
            let path = loc.uri.startsWith("file:///") ? loc.uri.slice(8) : loc.uri;
            if (path.startsWith("original/")) path = path.slice(9);
            else if (path.startsWith("modified/")) path = path.slice(9);

            if (!path.startsWith("/")) path = "/" + path;

            if (!group.has(path)) group.set(path, []);
            group.get(path)!.push({ location: loc, path });
        });

        setGroupedRefs(group);
        setExpandedFiles(new Set(group.keys()));

        // Fetch contexts for visible references (optimization: only fetch if few files)
        // For now, let's fetch for all if total is reasonable
        if (references.length > 0 && references.length < 100) {
            fetchContexts(group);
        }
    }, [references]);

    async function fetchContexts(group: Map<string, ReferenceItem[]>) {
        setLoadingContexts(true);
        const paths = Array.from(group.keys());

        // Fetch files one by one (or in parallel)
        await Promise.all(paths.map(async (path) => {
            try {
                const content = await getFileContent(repoId, path, "main"); // Fallback to main
                const lines = content.split('\n');

                const items = group.get(path);
                if (items) {
                    items.forEach(item => {
                        const startLine = item.location.range.start.line;
                        const snippet = lines[startLine]?.trim();
                        item.context = snippet;
                    });
                }
            } catch (e) {
                console.error(`Failed to fetch context for ${path}`, e);
            }
        }));

        setGroupedRefs(new Map(group));
        setLoadingContexts(false);
    }

    const toggleFile = (path: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    // Resize handling
    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (requestRef.current) return;

            requestRef.current = requestAnimationFrame(() => {
                const newHeight = window.innerHeight - e.clientY;
                setHeight(Math.max(100, Math.min(newHeight, window.innerHeight - 200)));
                requestRef.current = undefined;
            });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    const panelContent = useMemo(() => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="text-xs">Finding references...</span>
                </div>
            );
        }

        return (
            <div className="divide-y divide-zinc-800/50">
                {Array.from(groupedRefs.entries()).map(([path, items]) => (
                    <div key={path} className="flex flex-col">
                        <button
                            onClick={() => toggleFile(path)}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/50 text-left transition-colors group"
                        >
                            <ChevronRight className={`h-3 w-3 text-zinc-500 transition-transform ${expandedFiles.has(path) ? 'rotate-90' : ''}`} />
                            <FileCode className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-xs font-medium text-zinc-200 truncate">{path.split('/').pop()}</span>
                            <span className="text-[10px] text-zinc-500 font-mono truncate ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                {path}
                            </span>
                            <span className="bg-zinc-800 text-zinc-500 text-[9px] px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center ml-2 border border-zinc-700">
                                {items.length}
                            </span>
                        </button>

                        {expandedFiles.has(path) && (
                            <div className="bg-black/20">
                                {items.map((item, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onSelect(item.location)}
                                        className="w-full flex flex-col gap-1 px-8 py-2 hover:bg-blue-600/10 text-left border-l-2 border-transparent hover:border-blue-500 transition-all group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-500 font-mono">
                                                Line {item.location.range.start.line + 1}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-300 font-mono truncate bg-zinc-950/50 px-2 py-1 rounded border border-zinc-800 group-hover:border-zinc-700">
                                            {loadingContexts && !item.context ? (
                                                <div className="h-4 w-24 bg-zinc-800 animate-pulse rounded" />
                                            ) : (
                                                item.context || <span className="italic opacity-50">...</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }, [isLoading, groupedRefs, expandedFiles, loadingContexts, onSelect]);

    if (!isLoading && references.length === 0) return null;

    return (
        <div
            className={`flex flex-col bg-zinc-900 border-t border-zinc-800 shadow-2xl relative ${isResizing ? '' : 'animate-in slide-in-from-bottom duration-300'}`}
            style={{ height: `${height}px`, transition: isResizing ? 'none' : undefined }}
        >
            {/* Resize Handle */}
            <div
                className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-[101] group"
                onMouseDown={startResizing}
            >
                <div className={`w-full h-1 transition-colors ${isResizing ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-500/50'}`} />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-blue-400" />
                    <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                        References ({references.length})
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {panelContent}
            </div>
        </div>
    );
};
