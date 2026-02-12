import React, { useState, useEffect, useCallback, useRef } from "react";
import { Folder, File, ChevronRight, ChevronDown } from "lucide-react";
import { getRepoItems, type GitItem } from "../../api/repos";
import { Skeleton } from "../ui/Skeleton";

interface FileTreeNodeProps {
    repoId: string;
    item: GitItem;
    depth?: number;
    onSelect: (item: GitItem) => void;
    activePath?: string;
    branch?: string;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ repoId, item, depth = 0, onSelect, activePath, branch }) => {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<GitItem[]>([]);
    const [loading, setLoading] = useState(false);

    const isFolder = item.gitObjectType === "tree";
    const name = item.path.split("/").pop();

    const fetchChildren = useCallback(async () => {
        setLoading(true);
        try {
            const items = await getRepoItems(repoId, item.path, branch);
            const filteredItems = items.filter(child => child.path !== item.path);
            setChildren(filteredItems.sort((a, b) => {
                const aIsFolder = a.gitObjectType === "tree";
                const bIsFolder = b.gitObjectType === "tree";
                if (aIsFolder === bIsFolder) return a.path.localeCompare(b.path);
                return aIsFolder ? -1 : 1;
            }));
        } catch (err) {
            console.error("Failed to load items", err);
        } finally {
            setLoading(false);
        }
    }, [repoId, item.path, branch]);

    useEffect(() => {
        if (expanded && children.length === 0 && !loading) {
            fetchChildren();
        }
    }, [expanded, children.length, loading, fetchChildren]);

    useEffect(() => {
        if (!isFolder || !activePath) return;

        const normalizedItemPath = item.path.startsWith('/') ? item.path : '/' + item.path;
        const normalizedActivePath = activePath.startsWith('/') ? activePath : '/' + activePath;
        const dirPath = normalizedItemPath.endsWith('/') ? normalizedItemPath : normalizedItemPath + '/';

        if (normalizedActivePath.startsWith(dirPath)) {
            if (!expanded) {
                setExpanded(true);
            }
        }
    }, [activePath, isFolder, item.path, expanded]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) {
            setExpanded(prev => !prev);
        } else {
            onSelect(item);
        }
    };

    const isActive = activePath === item.path;
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isActive && rowRef.current) {
            rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [isActive]);

    return (
        <div>
            <div
                ref={rowRef}
                className={`flex items-center py-1 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm select-none transition-colors min-w-0 ${isActive ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={handleToggle}
            >
                <div className="mr-1 text-zinc-400 dark:text-zinc-500 w-4 flex justify-center shrink-0">
                    {isFolder && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                </div>
                <div className="mr-2 shrink-0">
                    {isFolder ? <Folder size={14} className="text-blue-500 dark:text-blue-400" /> : <File size={14} className="text-zinc-400 dark:text-zinc-500" />}
                </div>
                <span 
                    className={`truncate ${isFolder ? "text-zinc-900 dark:text-zinc-200" : "text-zinc-700 dark:text-zinc-300"}`}
                    title={name}
                >
                    {name}
                </span>
            </div>
            {expanded && (
                <div>
                    {loading && (
                        <div className="py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
                            <Skeleton className="h-4 w-24 my-1" />
                            <Skeleton className="h-4 w-16 my-1" />
                        </div>
                    )}
                    {children.map(child => (
                        <FileTreeNode
                            key={child.path}
                            repoId={repoId}
                            item={child}
                            depth={depth + 1}
                            onSelect={onSelect}
                            activePath={activePath}
                            branch={branch}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FileTree = ({ repoId, onSelect, activePath, branch }: { repoId: string, onSelect: (item: GitItem) => void, activePath?: string, branch?: string }) => {
    const [rootItems, setRootItems] = useState<GitItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getRepoItems(repoId, "/", branch)
            .then(items => {
                const filteredItems = items.filter(item => item.path !== "/");
                setRootItems(filteredItems.sort((a, b) => {
                    const aIsFolder = a.gitObjectType === "tree";
                    const bIsFolder = b.gitObjectType === "tree";
                    if (aIsFolder === bIsFolder) return a.path.localeCompare(b.path);
                    return aIsFolder ? -1 : 1;
                }));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [repoId]);

    if (loading) return (
        <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
        </div>
    );

    return (
        <div className="h-full overflow-auto py-2">
            {rootItems.map(item => (
                <FileTreeNode
                    key={item.path}
                    repoId={repoId}
                    item={item}
                    onSelect={onSelect}
                    activePath={activePath}
                    branch={branch}
                />
            ))}
        </div>
    );
};
