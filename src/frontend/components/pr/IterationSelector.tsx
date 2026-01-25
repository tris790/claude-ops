import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, History, ArrowRight } from "lucide-react";

interface Iteration {
    id: number;
    description?: string;
    createdDate: string;
    author: {
        displayName: string;
    };
    sourceRefCommit: {
        commitId: string;
    };
    targetRefCommit: {
        commitId: string;
    };
    commonRefCommit: {
        commitId: string;
    };
}

interface IterationSelectorProps {
    iterations: Iteration[];
    selectedIteration: number | null; // null means latest/current
    selectedBaseIteration: number | null; // null means base of the PR
    lastReviewedIterationId?: number | null;
    onSelect: (iterationId: number | null, baseIterationId: number | null) => void;
}

export function IterationSelector({ iterations, selectedIteration, selectedBaseIteration, lastReviewedIterationId, onSelect }: IterationSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Sort iterations descending (newest first)
    const sortedIterations = [...iterations].sort((a, b) => b.id - a.id);
    const latestId = sortedIterations.length > 0 ? sortedIterations[0]?.id || 0 : 0;

    // Derived display values
    const currentId = selectedIteration === null ? latestId : selectedIteration;
    const currentBaseId = selectedBaseIteration === null ? 0 : selectedBaseIteration;

    const getIterationLabel = (id: number) => {
        if (id === 0) return "Overview (Base)";
        const iter = iterations.find(i => i.id === id);
        return iter ? `Iteration ${iter.id}` : `Iteration ${id}`;
    };

    const handleSelect = (iterId: number, baseId: number) => {
        // normalizing: if picking latest as target and base as 0, use nulls
        const isLatest = iterId === latestId;
        const isDefaultBase = baseId === 0;

        if (isLatest && isDefaultBase) {
            onSelect(null, null);
        } else {
            onSelect(iterId, baseId);
        }
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-md text-sm text-zinc-300 transition-colors"
                title="Select Iteration"
            >
                <History className="h-4 w-4 text-zinc-500" />
                <span className="font-medium">
                    {currentBaseId === 0 ? "Base" : `Iter ${currentBaseId}`}
                </span>
                <ArrowRight className="h-3 w-3 text-zinc-600" />
                <span className="font-medium">
                    {currentId === latestId ? `Iter ${currentId} (Latest)` : `Iter ${currentId}`}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
                    <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Select Update</h4>
                        <p className="text-xs text-zinc-400">Compare specific push against previous version</p>
                    </div>

                    <div className="overflow-y-auto py-1">
                        {/* Option to view All Changes (Latest vs Base) */}
                        <button
                            onClick={() => handleSelect(latestId, 0)}
                            className={`w-full text-left px-4 py-2 hover:bg-zinc-800 flex items-center justify-between group ${currentId === latestId && currentBaseId === 0 ? "bg-zinc-800/50" : ""}`}
                        >
                            <div className="flex flex-col">
                                <span className={`text-sm ${currentId === latestId && currentBaseId === 0 ? "text-blue-400 font-medium" : "text-zinc-200"}`}>
                                    All Changes
                                </span>
                                <span className="text-xs text-zinc-500">Base &rarr; Iteration {latestId} (Latest)</span>
                            </div>
                            {(currentId === latestId && currentBaseId === 0) && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                        </button>

                        <div className="h-px bg-zinc-800 my-1 mx-4" />

                        {lastReviewedIterationId && lastReviewedIterationId < latestId && (
                            <>
                                <button
                                    onClick={() => handleSelect(latestId, lastReviewedIterationId)}
                                    className={`w-full text-left px-4 py-2 hover:bg-zinc-800 flex items-center justify-between group ${currentId === latestId && currentBaseId === lastReviewedIterationId ? "bg-zinc-800/50" : ""}`}
                                >
                                    <div className="flex flex-col">
                                        <span className={`text-sm ${currentId === latestId && currentBaseId === lastReviewedIterationId ? "text-blue-400 font-medium" : "text-zinc-200"}`}>
                                            Since My Last Review
                                        </span>
                                        <span className="text-xs text-zinc-500">Iter {lastReviewedIterationId} &rarr; Iteration {latestId} (Latest)</span>
                                    </div>
                                    {(currentId === latestId && currentBaseId === lastReviewedIterationId) && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                                </button>
                                <div className="h-px bg-zinc-800 my-1 mx-4" />
                            </>
                        )}

                        {sortedIterations.map((iter, index) => {
                            // Logic for "Changes in this iteration" (Compare Iter N with Iter N-1)
                            // If it's the first iteration (id 1), compare with 0 (Base)
                            const prevIterId = index < sortedIterations.length - 1 ? sortedIterations[index + 1]?.id || 0 : 0;

                            const isSelected = currentId === iter.id && currentBaseId === prevIterId;

                            return (
                                <button
                                    key={iter.id}
                                    onClick={() => handleSelect(iter.id, prevIterId)}
                                    className={`w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center justify-between group border-b border-zinc-800/50 last:border-0 ${isSelected ? "bg-zinc-800/50" : ""}`}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-medium ${isSelected ? "text-blue-400" : "text-zinc-200"}`}>
                                                Iteration {iter.id}
                                            </span>
                                            <span className="text-xs text-zinc-500">
                                                {new Date(iter.createdDate).toLocaleDateString()} {new Date(iter.createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-400 truncate max-w-[260px]">
                                            {iter.description || `Updated by ${iter.author.displayName}`}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                            {prevIterId === 0 ? "Base" : `Iter ${prevIterId}`} &rarr; Iter {iter.id}
                                        </div>
                                    </div>
                                    {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 ml-2" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
