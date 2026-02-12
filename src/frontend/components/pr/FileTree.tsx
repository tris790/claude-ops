import React, { useState, useMemo, memo } from "react";
import { FileCode, FilePlus, FileEdit, FileMinus, CheckSquare, Square, ChevronRight, ChevronDown, Folder } from "lucide-react";

interface FileChange {
    item: {
        path: string;
    };
    changeType: "add" | "edit" | "delete" | "rename";
}

interface FileTreeProps {
    changes: FileChange[];
    selectedPath: string | null;
    onSelect: (path: string) => void;
    reviewedFiles: Set<string>;
    onToggleReviewed: (path: string) => void;
}

interface TreeNode {
    name: string;
    path: string;
    children: Map<string, TreeNode>;
    change?: FileChange;
}

export const FileTree: React.FC<FileTreeProps> = memo(({
    changes,
    selectedPath,
    onSelect,
    reviewedFiles,
    onToggleReviewed
}) => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const tree = useMemo(() => {
        const root: TreeNode = { name: "", path: "", children: new Map() };
        changes.forEach(change => {
            const parts = change.item.path.split('/').filter(Boolean);
            let current = root;
            let currentPath = "";
            parts.forEach((part, index) => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!current.children.has(part)) {
                    current.children.set(part, {
                        name: part,
                        path: currentPath,
                        children: new Map()
                    });
                }
                current = current.children.get(part)!;
                if (index === parts.length - 1) {
                    current.change = change;
                }
            });
        });
        return root;
    }, [changes]);

    // Auto-expand folders on initial load if they are not too many
    React.useEffect(() => {
        const folders = new Set<string>();
        function collectFolders(node: TreeNode) {
            if (node.children.size > 0 && node.path) {
                folders.add(node.path);
            }
            node.children.forEach(collectFolders);
        }
        collectFolders(tree);
        setExpandedFolders(folders);
    }, [tree]);

    const toggleFolder = (path: string) => {
        const next = new Set(expandedFolders);
        if (next.has(path)) {
            next.delete(path);
        } else {
            next.add(path);
        }
        setExpandedFolders(next);
    };

    const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
        if (!node.name && depth === 0) {
            return Array.from(node.children.values())
                .sort((a, b) => {
                    const aIsFolder = a.children.size > 0;
                    const bIsFolder = b.children.size > 0;
                    if (aIsFolder && !bIsFolder) return -1;
                    if (!aIsFolder && bIsFolder) return 1;
                    return a.name.localeCompare(b.name);
                })
                .map(child => renderNode(child, depth));
        }

        const isFolder = node.children.size > 0;
        const isExpanded = expandedFolders.has(node.path);
        const isSelected = selectedPath === node.path;
        const isReviewed = node.change ? reviewedFiles.has(node.path) : false;

        return (
            <div key={node.path}>
                <div
                    className={`group flex items-center gap-1 py-1 px-2 cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-white/5 ${isSelected ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    onClick={() => {
                        if (isFolder) {
                            toggleFolder(node.path);
                        } else {
                            onSelect(node.path);
                        }
                    }}
                >
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                        {isFolder ? (
                            <div className="shrink-0 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </div>
                        ) : (
                            <div className="w-3.5 shrink-0" />
                        )}

                        {!isFolder && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (node.change) onToggleReviewed(node.path);
                                }}
                                className={`shrink-0 transition-colors mr-1 ${isReviewed ? 'text-green-500' : 'text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400'}`}
                            >
                                {isReviewed ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                            </button>
                        )}

                        <div className="shrink-0">
                            {isFolder ? (
                                <Folder className="h-4 w-4 text-sapphire-500/70" />
                            ) : (
                                <ChangeIcon type={node.change?.changeType || "edit"} />
                            )}
                        </div>

                        <span className={`text-sm truncate ${isReviewed ? 'opacity-50' : ''}`}>
                            {node.name}
                        </span>
                    </div>
                </div>
                {isFolder && isExpanded && (
                    <div>
                        {Array.from(node.children.values())
                            .sort((a, b) => {
                                const aIsFolder = a.children.size > 0;
                                const bIsFolder = b.children.size > 0;
                                if (aIsFolder && !bIsFolder) return -1;
                                if (!aIsFolder && bIsFolder) return 1;
                                return a.name.localeCompare(b.name);
                            })
                            .map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-800">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Files</h3>
                <span className="text-[10px] text-zinc-600 font-medium">{changes.length} changes</span>
            </div>
            <div className="flex-1 overflow-auto py-2">
                {renderNode(tree)}
            </div>
        </div>
    );
});

FileTree.displayName = "FileTree";

function ChangeIcon({ type }: { type: string }) {
    switch (type) {
        case "add": return <FilePlus className="h-4 w-4 text-green-600 dark:text-green-500" />;
        case "edit": return <FileEdit className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
        case "delete": return <FileMinus className="h-4 w-4 text-red-600 dark:text-red-500" />;
        default: return <FileCode className="h-4 w-4 text-zinc-500" />;
    }
}
