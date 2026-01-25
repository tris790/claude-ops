import React, { useEffect, useState, useRef } from "react";
import { Search, FileCode, GitPullRequest, ArrowRight, LayoutGrid, Settings } from "lucide-react";
import { cn } from "../utils/cn";
import { useNavigate, useLocation } from "react-router-dom";

interface CommandItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    action?: () => void;
    path?: string;
    category?: string;
}

export function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const [commands, setCommands] = useState<CommandItem[]>([]);
    const [searchResults, setSearchResults] = useState<CommandItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const baseCommands: CommandItem[] = [
            { id: "dashboard", label: "Go to Dashboard", icon: <LayoutGrid className="w-4 h-4" />, path: "/" },
            { id: "repos", label: "Go to Repositories", icon: <FileCode className="w-4 h-4" />, path: "/repos" },
            { id: "prs", label: "Go to Pull Requests", icon: <GitPullRequest className="w-4 h-4" />, path: "/prs" },
            { id: "settings", label: "Go to Settings", icon: <Settings className="w-4 h-4" />, path: "/settings" },
        ];

        // Context aware commands
        if (location.pathname.startsWith("/repos")) {
            baseCommands.unshift({
                id: "create-pr",
                label: "Create Pull Request",
                icon: <GitPullRequest className="w-4 h-4" />,
                action: () => console.log("Create PR action")
            });
        }

        setCommands(baseCommands);
    }, [location.pathname]);

    const [isRegex, setIsRegex] = useState(false);

    // ... (keep existing useEffects, but modify the search effect)

    const parseQuery = (raw: string) => {
        const filters: Record<string, string[]> = {};
        const textParts: string[] = [];

        const regex = /(\w+):"([^"]+)"|(\w+):([^ ]+)|([^ ]+)/g;
        let match;

        // Simple parser
        // If isRegex is true, we might want to disable operator parsing to avoid conflicts?
        // Or we key off spaces.
        // Let's assume operators are space delimited unless quoted.

        // Actually, splitting by space is easier but quotes are tricky.
        // Let's iterate.

        const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

        for (const part of parts) {
            if (part.includes(":") && !part.startsWith(":")) {
                const colonIndex = part.indexOf(":");
                const key = part.substring(0, colonIndex).toLowerCase();
                let value = part.substring(colonIndex + 1);

                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }

                if (!filters[key]) filters[key] = [];
                filters[key].push(value);
            } else {
                textParts.push(part);
            }
        }

        return {
            text: textParts.join(" "),
            filters
        };
    };

    // Search effect
    useEffect(() => {
        // Match /repos/:project/:repo
        const match = location.pathname.match(/^\/repos\/([^\/]+)\/([^\/]+)/);
        const project = match ? match[1] : null;
        const repo = match ? match[2] : null;

        if (!project || !repo || query.length < 3) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { text, filters } = parseQuery(query);

                // If query ends up empty after extraction and we relied on it, handle that.
                // But generally users type "file:foo bar" -> text="bar" filters={file:["foo"]}

                if (!text && Object.keys(filters).length === 0) {
                    setSearchResults([]);
                    setIsSearching(false);
                    return;
                }

                // Build Query String
                const params = new URLSearchParams();
                params.set("project", project);
                params.set("repo", repo);
                params.set("query", text || query); // Fallback if text is empty? Search * is complex.
                params.set("isRegex", isRegex.toString());

                if (filters["file"]) filters["file"].forEach(f => params.append("file", f));
                if (filters["ext"]) filters["ext"].forEach(e => params.append("file", `*.${e}`));
                // "context" to 2 by default
                params.set("context", "2");

                const res = await fetch(`/api/repos/search?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.map((item: any, i: number) => ({
                        id: `search-${i}`,
                        label: item.file,
                        icon: <FileCode className="w-4 h-4 text-blue-400" />,
                        category: "Code Search",
                        description: `${item.line}: ${item.content.trim()}`, // TODO: Show context?
                        // We can store full item data to render differently
                        action: () => {
                            navigate(`/repos/${project}/${repo}/blob/HEAD/${item.file}?line=${item.line}`);
                        }
                    })));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, isRegex, location.pathname, navigate]);


    const filteredCommands = [
        ...commands.filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase())),
        ...searchResults
    ];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "p")) {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            // slight delay to ensure render
            setTimeout(() => inputRef.current?.focus(), 10);
            setQuery("");
            setSelectedIndex(0);
            setSearchResults([]);
        }
    }, [isOpen]);

    const handleSelect = (command: CommandItem) => {
        setIsOpen(false);
        if (command.action) {
            command.action();
        } else if (command.path) {
            navigate(command.path);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filteredCommands[selectedIndex]) {
                handleSelect(filteredCommands[selectedIndex]);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 font-sans">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-white/10">
                <div className="flex items-center border-b border-zinc-800 px-4 h-14">
                    <Search className="w-5 h-5 text-zinc-500 mr-3" />
                    <input
                        ref={inputRef}
                        className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-500 text-lg focus:ring-0"
                        placeholder="Type a command or search code..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => setIsRegex(!isRegex)}
                            className={cn(
                                "p-1 rounded text-xs font-mono border transition-colors",
                                isRegex
                                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                    : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300"
                            )}
                            title="Toggle Regex"
                        >
                            .*
                        </button>
                        {isSearching && <span className="text-zinc-500 text-xs animate-pulse">Searching...</span>}
                        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400">
                            <span className="text-xs">ESC</span>
                        </kbd>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto py-2 p-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    {filteredCommands.length === 0 ? (
                        <div className="py-8 text-center text-sm text-zinc-500">No results found.</div>
                    ) : (
                        <div className="space-y-1">
                            {filteredCommands.map((cmd, index) => (
                                <button
                                    key={cmd.id}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors text-left group",
                                        index === selectedIndex
                                            ? "bg-sapphire-500/10 text-sapphire-400"
                                            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                                    )}
                                    onClick={() => handleSelect(cmd)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className={cn(
                                        "flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
                                        index === selectedIndex
                                            ? "bg-sapphire-500/20 border-sapphire-500/30 text-sapphire-400"
                                            : "bg-zinc-800/50 border-zinc-700/50 text-zinc-500 group-hover:bg-zinc-800 group-hover:text-zinc-300"
                                    )}>
                                        {cmd.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{cmd.label}</div>
                                        {(cmd as any).description && (
                                            <div className="text-xs text-zinc-500 truncate font-mono opacity-80">{(cmd as any).description}</div>
                                        )}
                                    </div>
                                    {cmd.shortcut && (
                                        <span className="text-xs text-zinc-500">{cmd.shortcut}</span>
                                    )}
                                    {index === selectedIndex && (
                                        <ArrowRight className="w-4 h-4 opacity-50 animate-pulse" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="h-9 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-4 text-[11px] text-zinc-500">
                    <div className="flex gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 text-xs">↵</kbd>
                            to select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 text-xs">↑↓</kbd>
                            to navigate
                        </span>
                    </div>
                    <div className="opacity-50">
                        ClaudeOps
                    </div>
                </div>
            </div>
        </div>
    );
}
