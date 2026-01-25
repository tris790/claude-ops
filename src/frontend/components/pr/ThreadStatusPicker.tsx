import React from "react";
import { ChevronDown } from "lucide-react";

export interface ThreadStatus {
    id: number;
    label: string;
    color: string;
}

export const THREAD_STATUSES = [
    { id: 1, label: "Active", color: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" },
    { id: 2, label: "Resolved", color: "bg-green-500/20 text-green-400 hover:bg-green-500/30" },
    { id: 3, label: "Won't Fix", color: "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700/70" },
    { id: 4, label: "Closed", color: "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700/70" },
    { id: 5, label: "By Design", color: "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" },
    { id: 6, label: "Pending", color: "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" },
] as const;

interface ThreadStatusPickerProps {
    status: number;
    onStatusChange: (status: number) => void;
    compact?: boolean;
}

export function ThreadStatusPicker({ status, onStatusChange, compact = false }: ThreadStatusPickerProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const currentStatus = THREAD_STATUSES.find(s => s.id === (status || 1)) ?? THREAD_STATUSES[0];

    return (
        <div className="relative">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`flex items-center gap-1 rounded-full font-bold uppercase tracking-wider transition-colors ${compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"
                    } ${currentStatus.color}`}
            >
                {currentStatus.label}
                <ChevronDown className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                    />
                    <div className="absolute top-full left-0 mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1">
                        {THREAD_STATUSES.map(s => (
                            <button
                                key={s.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusChange(s.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${s.id === status
                                    ? 'bg-white/10 ' + s.color
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                    }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
