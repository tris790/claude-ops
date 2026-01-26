import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FixedSizeList as List } from "react-window";
import { useWorkItemCache } from "../hooks/useWorkItemCache";
import {
    CheckCircle2,
    Circle,
    Clock,
    Tag,
    ChevronRight,
    Search,
    X,
    LayoutList
} from "lucide-react";
import { cn } from "../utils/cn";
import { Input } from "../components/ui/Input";

// Helper for window size
function useWindowWidth() {
    const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
    return width;
}

export function WorkItems() {
    const navigate = useNavigate();
    const [filter, setFilter] = useState("my");
    const [searchQuery, setSearchQuery] = useState("");

    // Cache Hook
    const { items, loading, filterItems, refresh } = useWorkItemCache();

    // Virtualization
    const windowWidth = useWindowWidth();
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(1200);
    const [containerHeight, setContainerHeight] = useState(800);

    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth);
            setContainerHeight(containerRef.current.clientHeight);
        }
    }, [windowWidth, loading]);

    // Filtered Data
    const displayItems = useMemo(() => {
        // We simulate the "Recent" vs "My" by just sorting differently if we wanted, 
        // but for now we follow original logic which returns same items.
        // We apply the search query.
        return filterItems({ query: searchQuery });
    }, [searchQuery, items, filterItems]);

    const getStatusIcon = (state: string) => {
        switch (state?.toLowerCase()) {
            case "active": return <Clock className="h-4 w-4 text-blue-500" />;
            case "closed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case "new": return <Circle className="h-4 w-4 text-zinc-500" />;
            case "resolved": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
            default: return <Circle className="h-4 w-4 text-zinc-500" />;
        }
    };

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const item = displayItems[index];
        return (
            <div style={style} className="border-b border-zinc-800/30">
                <div
                    onClick={() => navigate(`/workitems/${item.id}`)}
                    className="group flex items-center h-full hover:bg-white/5 transition-colors cursor-pointer px-4"
                >
                    <div className="w-20 text-sm text-zinc-500 font-mono shrink-0">#{item.id}</div>
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex flex-col">
                            <span className="text-zinc-200 font-medium group-hover:text-blue-400 transition-colors truncate">
                                {item.fields["System.Title"]}
                            </span>
                            <span className="text-xs text-zinc-500 mt-0.5 truncate">{item.fields["System.WorkItemType"]}</span>
                        </div>
                    </div>
                    <div className="w-32 shrink-0">
                        <div className="flex items-center gap-2">
                            {getStatusIcon(item.fields["System.State"])}
                            <span className="text-sm text-zinc-300 truncate">{item.fields["System.State"]}</span>
                        </div>
                    </div>
                    <div className="w-40 shrink-0">
                        {item.fields["System.AssignedTo"] ? (
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 lowercase shrink-0">
                                    {item.fields["System.AssignedTo"].displayName[0]}
                                </div>
                                <span className="text-sm text-zinc-400 truncate">{item.fields["System.AssignedTo"].displayName}</span>
                            </div>
                        ) : (
                            <span className="text-xs text-zinc-600 italic">Unassigned</span>
                        )}
                    </div>
                    <div className="w-10 flex justify-end shrink-0 text-zinc-600">
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-60px)] flex flex-col space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Work Items</h1>
                    <p className="text-zinc-500 text-sm mt-1">Track and manage your tasks across projects.</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Search */}
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Search Work Items..."
                            className="pl-9 h-9 bg-zinc-900 border-zinc-800 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        <button
                            onClick={() => setFilter("my")}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                filter === "my" ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            Assigned to Me
                        </button>
                        <button
                            onClick={() => setFilter("recent")}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                filter === "recent" ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            Recently Updated
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col">
                {/* Header */}
                <div className="flex items-center px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/80 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex-none">
                    <div className="w-20">ID</div>
                    <div className="flex-1">Title</div>
                    <div className="w-32">State</div>
                    <div className="w-40">Assigned To</div>
                    <div className="w-10"></div>
                </div>

                {/* List */}
                <div className="flex-1 relative" ref={containerRef}>
                    {loading && !items.length ? (
                        <div className="space-y-4 p-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="animate-pulse flex items-center h-16 border-b border-zinc-800/30">
                                    <div className="w-20 px-4"><div className="h-4 bg-zinc-800 rounded w-12" /></div>
                                    <div className="flex-1 px-4"><div className="h-4 bg-zinc-800 rounded w-3/4" /></div>
                                    <div className="w-32 px-4"><div className="h-4 bg-zinc-800 rounded w-20" /></div>
                                    <div className="w-40 px-4"><div className="h-4 bg-zinc-800 rounded w-24" /></div>
                                </div>
                            ))}
                        </div>
                    ) : displayItems.length > 0 ? (
                        <List
                            height={containerHeight - 40} // Subtract header height approximation if needed, or just containerHeight since header is outside ref? 
                            // Actually containerRef is on the div wrapping the list, below header. So containerHeight should be full height of that div.
                            // But wait, containerHeight is reduced by header? 
                            // Flex layout: flex-1 will make that div take remaining space.
                            // So containerRef.current.clientHeight will be correct!
                            itemCount={displayItems.length}
                            itemSize={72}
                            width={containerWidth}
                            className="scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
                        >
                            {Row}
                        </List>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <Tag className="h-8 w-8 text-zinc-800 mb-2" />
                            <p className="text-zinc-500">No work items found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
