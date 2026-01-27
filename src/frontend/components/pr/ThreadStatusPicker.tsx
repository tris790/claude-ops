import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export interface ThreadStatus {
    id: number;
    label: string;
    color: string;
}

export const THREAD_STATUSES = [
    { id: 1, value: "active", label: "Active", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30" },
    { id: 2, value: "fixed", label: "Resolved", color: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30" },
    { id: 3, value: "wontFix", label: "Won't Fix", color: "bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/70" },
    { id: 4, value: "closed", label: "Closed", color: "bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/70" },
    { id: 5, value: "byDesign", label: "By Design", color: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30" },
    { id: 6, value: "pending", label: "Pending", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30" },
] as const;

export function isThreadActive(status: number | string) {
    return status === 1 || status === 0 || status === "active" || status === "unknown";
}

export function isThreadResolved(status: number | string) {
    return status === 2 || status === "fixed";
}

export function isThreadClosed(status: number | string) {
    return status === 4 || status === "closed" || status === 3 || status === "wontFix" || status === 5 || status === "byDesign";
}

export function isThreadPending(status: number | string) {
    return status === 6 || status === "pending";
}

interface ThreadStatusPickerProps {
    status: number | string;
    onStatusChange: (status: number | string) => void;
    compact?: boolean;
}

export function ThreadStatusPicker({ status, onStatusChange, compact = false }: ThreadStatusPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const currentStatus = THREAD_STATUSES.find(s => s.id === status || s.value === status) ?? THREAD_STATUSES[0];

    React.useLayoutEffect(() => {
        if (isOpen && triggerRef.current) {
            const updatePosition = () => {
                const rect = triggerRef.current!.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX
                });
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true); // true for capturing scroll in parents

            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        } else {
            setPosition(null);
        }
    }, [isOpen]);

    return (
        <>
            <button
                ref={triggerRef}
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

            {isOpen && position && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[9999]"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                    />
                    <div
                        className="absolute z-[9999] w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: position.top, left: position.left }}
                    >
                        {THREAD_STATUSES.map(s => (
                            <button
                                key={s.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusChange(s.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${s.id === status || s.value === status
                                    ? 'bg-zinc-100 dark:bg-white/10 ' + s.color
                                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </>
    );
}
