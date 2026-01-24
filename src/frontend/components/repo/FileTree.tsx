import React, { useState, useEffect } from "react";
import { Folder, File, ChevronRight, ChevronDown } from "lucide-react";
import { getRepoItems, type GitItem } from "../../api/repos";

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

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) {
            if (expanded) {
                setExpanded(false);
            } else {
                setExpanded(true);
                if (children.length === 0) {
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
                }
            }
        } else {
            onSelect(item);
        }
    };

    const isActive = activePath === item.path;

    return (
        <div>
            <div
                className={`flex items-center py-1 px-2 hover:bg-zinc-800 cursor-pointer text-sm select-none transition-colors ${isActive ? "bg-zinc-800" : ""}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={handleToggle}
            >
                <div className="mr-1 text-zinc-500 w-4 flex justify-center">
                    {isFolder && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                </div>
                <div className="mr-2">
                    {isFolder ? <Folder size={14} className="text-blue-400" /> : <File size={14} className="text-zinc-500" />}
                </div>
                <span className={isFolder ? "text-zinc-200" : "text-zinc-300"}>
                    {name}
                </span>
            </div>
            {expanded && (
                <div>
                    {loading && <div className="pl-8 text-xs text-zinc-600 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>Loading...</div>}
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

    if (loading) return <div className="p-4 text-xs text-zinc-500">Loading tree...</div>;

    return (
        <div className="h-full overflow-y-auto py-2">
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
