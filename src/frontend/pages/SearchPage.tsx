import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useRepoContext } from "../contexts/RepoContext";
import { Search, FileCode, Folder, Loader2, Filter, ChevronRight, ChevronDown, X } from "lucide-react";
import { VariableSizeList as List } from "react-window";

interface SearchResult {
    type: "match";
    file: string;
    line: number;
    content: string;
    repo: string;
    project: string;
}

// Optimization: Pre-compute lowercase strings for faster searching
interface SearchableResult extends SearchResult {
    searchString: string;
}

type ListItem =
    | { type: "header"; repo: string; project: string; count: number; fileCount: number }
    | { type: "item"; result: SearchResult };

function useContainerSize() {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, width: size.width, height: size.height };
}

export function SearchPage() {
    const { clearContext } = useRepoContext();

    // Clear repo context when on search page
    useEffect(() => {
        clearContext();
    }, [clearContext]);

    const [searchParams, setSearchParams] = useSearchParams();
    const activeSearch = searchParams.get("q") || "";

    // Local state for main search input
    const [inputValue, setInputValue] = useState(activeSearch);

    // State for results
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState<{ count: number, timeMs: number } | null>(null);
    const [collapsedRepos, setCollapsedRepos] = useState<Set<string>>(new Set());

    // Filter state
    const [isPending, startTransition] = useTransition();
    const [filter, setFilter] = useState("");
    const [filterInput, setFilterInput] = useState("");
    const [showFilter, setShowFilter] = useState(false);
    const filterInputRef = useRef<HTMLInputElement>(null);

    const { ref: containerRef, width, height } = useContainerSize();
    const listRef = useRef<List>(null);

    // Sync input with URL if it changes externally
    useEffect(() => {
        setInputValue(activeSearch);
    }, [activeSearch]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "f") {
                e.preventDefault();
                setShowFilter(prev => !prev);
            } else if (e.key === "Escape" && showFilter) {
                setShowFilter(false);
                setFilter("");
                setFilterInput("");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showFilter]);

    // Auto-focus filter input when shown
    useEffect(() => {
        if (showFilter && filterInputRef.current) {
            filterInputRef.current.focus();
            filterInputRef.current.select();
        }
    }, [showFilter]);

    // Trigger search when activeSearch (URL) changes
    useEffect(() => {
        if (activeSearch) {
            handleSearch(activeSearch);
        } else {
            setResults([]);
            setStats(null);
        }
    }, [activeSearch]);

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleSearch = async (searchQuery: string) => {
        if (!searchQuery.trim()) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const aborter = new AbortController();
        abortControllerRef.current = aborter;

        setIsLoading(true);
        setResults([]);
        setStats(null);
        const start = performance.now();

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
                signal: aborter.signal
            });

            if (!res.body) throw new Error("No body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let count = 0;

            // Batching
            let pendingItems: SearchResult[] = [];

            // We use a ref to check if we are still active (though abort signal handles fetch, the processing loop needs care)
            const flush = () => {
                if (pendingItems.length === 0) return;
                // Functional update to avoid stale closure
                const itemsToAdd = [...pendingItems];
                pendingItems = [];
                setResults(prev => [...prev, ...itemsToAdd]);
            };

            // Flush periodically to show progress
            const interval = setInterval(flush, 64); // ~15fps updates

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const item = JSON.parse(line);
                        pendingItems.push(item);
                        count++;
                    } catch (e) { }
                }
            }

            clearInterval(interval);
            flush(); // Final flush

            const end = performance.now();
            setStats({
                count: count,
                timeMs: Math.round(end - start)
            });

        } catch (e: any) {
            if (e.name === "AbortError") {
                // Ignore aborts
                return;
            }
            console.error("Search failed", e);
        } finally {
            if (abortControllerRef.current === aborter) {
                setIsLoading(false);
                abortControllerRef.current = null;
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            setSearchParams({ q: inputValue });
        } else {
            setSearchParams({});
        }
    };

    // Optimization: Pre-process results for fast filtering
    const searchableItems = useMemo<SearchableResult[]>(() => {
        return results.map(r => ({
            ...r,
            searchString: (r.file + " " + r.content + " " + r.repo).toLowerCase()
        }));
    }, [results]);

    // "Search the search" - Client side filtering
    const filteredResults = useMemo(() => {
        if (!filter) return results;
        const lowerFilter = filter.toLowerCase();
        return searchableItems.filter(r => r.searchString.includes(lowerFilter));
    }, [results, searchableItems, filter]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFilterInput(value);
        startTransition(() => {
            setFilter(value);
        });
    };

    // Group results
    const listItems = useMemo(() => {
        const grouped = filteredResults.reduce((acc, result) => {
            const key = `${result.project}/${result.repo}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(result);
            return acc;
        }, {} as Record<string, SearchResult[]>);

        const items: ListItem[] = [];
        const sortedKeys = Object.keys(grouped).sort();

        sortedKeys.forEach((key) => {
            const parts = key.split("/");
            if (parts.length >= 2) {
                const project = parts[0]!;
                const repo = parts[1]!;
                const groupResults = grouped[key] || [];

                const fileCount = new Set(groupResults.map(r => r.file)).size;

                items.push({ type: "header", repo, project, count: groupResults.length, fileCount });

                if (!collapsedRepos.has(key)) {
                    groupResults.forEach(result => {
                        items.push({ type: "item", result });
                    });
                }
            }
        });
        return items;
    }, [filteredResults, collapsedRepos]);

    // Reset list layout when items change
    useEffect(() => {
        if (listRef.current) {
            listRef.current.resetAfterIndex(0);
        }
    }, [listItems]);

    const toggleRepo = (project: string, repo: string) => {
        const key = `${project}/${repo}`;
        const newCollapsed = new Set(collapsedRepos);
        if (newCollapsed.has(key)) {
            newCollapsed.delete(key);
        } else {
            newCollapsed.add(key);
        }
        setCollapsedRepos(newCollapsed);
    };

    const getItemSize = (index: number) => {
        const item = listItems[index];
        if (!item) return 80;
        return item.type === "header" ? 24 : 80;
    };

    const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
        const item = listItems[index];
        if (!item) return null;

        if (item.type === "header") {
            const key = `${item.project}/${item.repo}`;
            const isCollapsed = collapsedRepos.has(key);

            return (
                <div
                    style={style}
                    className="h-6 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center px-3 text-xs text-zinc-500 select-none justify-between cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => toggleRepo(item.project, item.repo)}
                >
                    <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.project} / {item.repo}</span>
                    </div>
                    <div>
                        {item.fileCount} files <span className="mx-1 opacity-50">·</span> {item.count} matches
                    </div>
                </div>
            );
        }

        const { result } = item;
        return (
            <div style={style} className="px-4 py-2 hover:bg-white/5 transition-colors border-b border-zinc-800/50 bg-zinc-900/30">
                <Link
                    to={`/repos/${result.project}/${result.repo}/blob/HEAD/${result.file}#L${result.line}`}
                    className="block group pl-6"
                >
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                        <FileCode className="w-3 h-3 text-blue-400" />
                        <span className="text-zinc-300 font-medium group-hover:text-blue-400 transition-colors">
                            {result.file}
                        </span>
                    </div>

                    <div className="flex gap-4 font-mono text-sm">
                        <span className="text-zinc-600 select-none w-10 text-right">{result.line}</span>
                        <div className="flex-1 overflow-hidden">
                            <span className="text-zinc-300 whitespace-pre">
                                {result.content.length > 300 ? result.content.substring(0, 300) + "..." : result.content}
                            </span>
                        </div>
                    </div>
                </Link>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-zinc-900 text-zinc-200 relative">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 bg-zinc-900 z-10 shrink-0">
                <div className="max-w-5xl mx-auto space-y-4">
                    <h1 className="text-xl font-semibold text-white">Advanced Search</h1>

                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Search code... (e.g. 'function login', 'ext:ts auth', 'file:service api')"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2.5 pl-10 pr-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-mono text-sm"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-md font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                        </button>
                    </form>

                    {/* Active Filters Display */}
                    {inputValue && (
                        <div className="flex flex-wrap gap-2 min-h-[24px]">
                            {inputValue.split(/\s+/).map((part, i) => {
                                if (part.startsWith("ext:")) {
                                    return (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            <span className="opacity-50">ext:</span>
                                            {part.substring(4)}
                                        </span>
                                    );
                                }
                                if (part.startsWith("file:")) {
                                    return (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                            <span className="opacity-50">file:</span>
                                            {part.substring(5)}
                                        </span>
                                    );
                                }
                                if (part === "regex") {
                                    return (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                            Regex Mode
                                        </span>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}

                    {/* Stats */}
                    {(results.length > 0 || isLoading) && (
                        <div className="flex items-center justify-between text-sm min-h-[32px]">
                            <div className="text-zinc-500 flex items-center gap-3">
                                {isLoading ? (
                                    <span>Searching...</span>
                                ) : (
                                    <>
                                        <span>Found {filteredResults.length.toLocaleString()} results {filter ? `(filtered from ${results.length})` : ''} in {stats?.timeMs}ms</span>
                                        {!showFilter && <span className="text-xs px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500 border border-zinc-700/50">Press Ctrl+F to filter</span>}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Elegant Floating Filter Bar */}
            <div className={`absolute top-[140px] right-0 left-0 flex justify-center pointer-events-none transition-all duration-200 ease-out z-20 ${showFilter ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 shadow-2xl rounded-xl p-2 flex items-center gap-2 w-[500px] pointer-events-auto transform ring-1 ring-black/50">
                    <Filter className="w-4 h-4 text-zinc-400 ml-2" />
                    <input
                        ref={filterInputRef}
                        type="text"
                        value={filterInput}
                        onChange={handleFilterChange}
                        placeholder="Filter within results..."
                        className="bg-transparent border-none focus:ring-0 text-sm text-zinc-200 placeholder:text-zinc-500 flex-1 min-w-0"
                    />
                    <div className="flex items-center gap-1 pr-1">
                        {filterInput && (
                            <button onClick={() => { setFilter(""); setFilterInput(""); }} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300">
                                <span className="text-xs">Clear</span>
                            </button>
                        )}
                        <span className="h-4 w-px bg-zinc-700 mx-1"></span>
                        <button onClick={() => setShowFilter(false)} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-hidden" ref={containerRef}>
                {width > 0 && height > 0 && !isLoading && listItems.length > 0 && (
                    <div className={isPending ? "opacity-50 transition-opacity" : "transition-opacity"}>
                        <List
                            ref={listRef}
                            height={height}
                            itemCount={listItems.length}
                            itemSize={getItemSize}
                            width={width}
                        >
                            {Row}
                        </List>
                    </div>
                )}

                {!isLoading && listItems.length === 0 && activeSearch && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <Search className="w-12 h-12 mb-4 opacity-20" />
                        <p>
                            {filter ? "No results match your filter" : `No results found for "${activeSearch}"`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
