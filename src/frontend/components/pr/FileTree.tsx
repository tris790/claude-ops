import React from "react";
import { FileCode, FilePlus, FileEdit, FileMinus } from "lucide-react";

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
}

export const FileTree: React.FC<FileTreeProps> = ({ changes, selectedPath, onSelect }) => {
    return (
        <div className="flex flex-col h-full bg-zinc-900/50 border-r border-zinc-800">
            <div className="p-4 border-b border-zinc-800">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Modified Files</h3>
            </div>
            <div className="flex-1 overflow-auto py-2">
                {changes.map((change) => {
                    const isSelected = selectedPath === change.item.path;
                    const fileName = change.item.path.split('/').pop();
                    const dirPath = change.item.path.split('/').slice(0, -1).join('/');

                    return (
                        <div
                            key={change.item.path}
                            onClick={() => onSelect(change.item.path)}
                            className={`px-4 py-2 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                        >
                            <ChangeIcon type={change.changeType} />
                            <div className="min-w-0">
                                <div className="text-sm truncate font-medium">{fileName}</div>
                                {dirPath && <div className="text-[10px] text-zinc-600 truncate">{dirPath}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

function ChangeIcon({ type }: { type: string }) {
    switch (type) {
        case "add": return <FilePlus className="h-4 w-4 text-green-500" />;
        case "edit": return <FileEdit className="h-4 w-4 text-blue-500" />;
        case "delete": return <FileMinus className="h-4 w-4 text-red-500" />;
        default: return <FileCode className="h-4 w-4 text-zinc-500" />;
    }
}
