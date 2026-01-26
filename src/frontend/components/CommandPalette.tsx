import React, { useEffect, useState, useRef, useMemo } from "react";
import { Search, FileCode, GitPullRequest, ArrowRight, LayoutGrid, Settings } from "lucide-react";
import { cn } from "../utils/cn";
import { useNavigate, useLocation } from "react-router-dom";
import { fuzzyScore } from "../utils/fuzzy";
import { RecencyService } from "../services/recency";
import { useRepositoryCache } from "../hooks/useRepositoryCache";

interface CommandItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    action?: () => void;
    path?: string;
    category?: string;
    description?: string;
    project?: string;
    repo?: string;
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

    // Repos Cache
    const { repos } = useRepositoryCache();

    // Get current context
    const match = location.pathname.match(/^\/repos\/([^\/]+)\/([^\/]+)/);
    const currentProject = match ? match[1] : null;
    const currentRepo = match ? match[2] : null;

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
                action: () => console.log("Create PR action"),
                project: currentProject || undefined,
                repo: currentRepo || undefined
            });
        }

        setCommands(baseCommands);
    }, [location.pathname, currentProject, currentRepo]);

    const [isRegex, setIsRegex] = useState(false);
    const isFileSearch = query.startsWith("/");

    const parseQuery = (raw: string) => {
        const filters: Record<string, string[]> = {};
        const textParts: string[] = [];
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
        if (!currentProject || !currentRepo || query.length < 3) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { text, filters } = parseQuery(query);
                const effectiveText = isFileSearch && text.startsWith("/") ? text.slice(1) : text;

                if (!effectiveText && Object.keys(filters).length === 0 && !isFileSearch) {
                    setSearchResults([]);
                    setIsSearching(false);
                    return;
                }

                const params = new URLSearchParams();
                params.set("project", currentProject);
                params.set("repo", currentRepo);
                params.set("query", effectiveText || (isFileSearch ? query.slice(1) : query));
                params.set("isRegex", isRegex.toString());

                if (filters["file"]) filters["file"].forEach(f => params.append("file", f));
                if (filters["ext"]) filters["ext"].forEach(e => params.append("file", `*.${e}`));
                params.set("context", "2");
                if (isFileSearch) {
                    params.set("type", "path");
                }

                const res = await fetch(`/api/repos/search?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.map((item: any, i: number) => ({
                        id: `search-${i}-${item.file}-${item.line}`,
                        label: item.file,
                        icon: <FileCode className="w-4 h-4 text-sapphire-400" />,
                        category: "Code Search",
                        description: item.line > 0 ? `${item.line}: ${item.content.trim()}` : item.file,
                        project: currentProject,
                        repo: currentRepo,
                        action: () => {
                            navigate(`/repos/${currentProject}/${currentRepo}/blob/HEAD/${item.file}?line=${item.line}`);
                        }
                    })));
                } else {
                    setSearchResults([]);
                }
            } catch (e) {
                console.error(e);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, isRegex, currentProject, currentRepo, navigate]);

    // RANKING ALGORITHM
    const filteredCommands = useMemo(() => {
        const { text: cleanQuery } = parseQuery(query);
        let searchInput = cleanQuery || query;

        if (isFileSearch && searchInput.startsWith("/")) {
            searchInput = searchInput.slice(1);
        }

        // Convert repos to commands
        const repoCommands: CommandItem[] = repos.map(r => ({
            id: `repo:${r.id}`,
            label: r.name,
            icon: <LayoutGrid className="w-4 h-4 text-zinc-400" />,
            category: "Repositories",
            project: r.project.name,
            repo: r.name,
            description: r.project.name,
            path: `/repos/${r.project.name}/${r.name}`
        }));

        const allItems = [...commands, ...repoCommands, ...searchResults];

        if (!searchInput) {
            return allItems.sort((a, b) => {
                const scoreA = RecencyService.getScoreBoost(a.id);
                const scoreB = RecencyService.getScoreBoost(b.id);
                return scoreB - scoreA;
            }).slice(0, 50);
        }

        const scored = allItems.map(item => {
            let score = 0;

            const labelScore = fuzzyScore(item.label, searchInput);

            if (labelScore === -Infinity) {
                if (item.category === "Code Search") {
                    const fileMatchScore = fuzzyScore(item.label, searchInput);

                    if (fileMatchScore > -Infinity) {
                        score = fileMatchScore + 50;
                    } else {
                        score = 10;
                    }

                    if (isFileSearch) {
                        score += 20;
                    }
                } else {
                    return { item, score: -Infinity };
                }
            } else {
                score = labelScore;
            }

            if (currentProject && item.project === currentProject) {
                score += 20;
            }
            if (currentRepo && item.repo === currentRepo) {
                score += 10;
            }

            const recencyBoost = RecencyService.getScoreBoost(item.id);
            score += recencyBoost;

            // Boost Repos slightly over static commands if search matches
            if (item.category === "Repositories") {
                score += 5;
            }

            return { item, score };
        });

        return scored
            .filter(x => x.score > -Infinity)
            .sort((a, b) => b.score - a.score)
            .map(x => x.item)
            .slice(0, 50);

    }, [commands, searchResults, query, currentProject, currentRepo, repos]);

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
            setTimeout(() => inputRef.current?.focus(), 10);
            setQuery("");
            setSelectedIndex(0);
            setSearchResults([]);
        }
    }, [isOpen]);

    const handleSelect = (command: CommandItem) => {
        RecencyService.track({
            id: command.id,
            label: command.label,
            type: command.category === "Code Search" ? 'file' : 'command',
            path: command.path || "",
            meta: {
                project: command.project,
                repo: command.repo
            }
        });

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
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setIsOpen(false)}
            />

            <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-white/10">
                <div className="flex items-center border-b border-zinc-800 px-4 h-14">
                    <Search className="w-5 h-5 text-zinc-500 mr-3" />
                    <div className="relative flex-1">
                        {isFileSearch && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 bg-sapphire-500/20 text-sapphire-400 border border-sapphire-500/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold flex items-center shadow-sm z-10 select-none pointer-events-none">
                                /
                            </div>
                        )}
                        <input
                            ref={inputRef}
                            className={cn(
                                "w-full bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-500 text-lg focus:ring-0",
                                isFileSearch && "pl-8"
                            )}
                            placeholder={isFileSearch ? "Search files..." : "Type a command or search code..."}
                            value={isFileSearch ? query.slice(1) : query}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (isFileSearch) {
                                    setQuery("/" + val);
                                } else {
                                    setQuery(val);
                                }
                                setSelectedIndex(0);
                            }}
                            onKeyDown={(e) => {
                                if (isFileSearch && e.key === "Backspace" && query === "/") {
                                    setQuery("");
                                    e.preventDefault();
                                }
                                handleKeyDown(e);
                            }}
                        />
                    </div>
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
                    {isSearching && filteredCommands.length === 0 ? (
                        <div className="py-8 flex flex-col items-center justify-center text-zinc-500 gap-2">
                            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                            <span className="text-sm">Searching...</span>
                        </div>
                    ) : filteredCommands.length === 0 ? (
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
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">
                                                {/* Highlight matches in label if possible, for now just text */}
                                                {cmd.label}
                                            </span>
                                            {cmd.project && cmd.category !== "Code Search" && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
                                                    {cmd.project}{cmd.repo ? `/${cmd.repo}` : ''}
                                                </span>
                                            )}
                                            {cmd.category === "Code Search" && isFileSearch && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sapphire-900/30 text-sapphire-400 border border-sapphire-500/20">
                                                    File Match
                                                </span>
                                            )}
                                        </div>
                                        {cmd.description && (
                                            <div className="text-xs text-zinc-500 truncate font-mono opacity-80">{cmd.description}</div>
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
