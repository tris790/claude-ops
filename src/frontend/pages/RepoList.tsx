import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, GitBranch, Download, RefreshCw, Check, Filter, X, ChevronDown, Clock, ArrowDownAZ } from "lucide-react";
import { FixedSizeList as List } from "react-window";
import { cloneRepository, syncRepository, type GitRepository } from "../api/repos";
import { useRepositoryCache } from "../hooks/useRepositoryCache";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { MultiSelect, type MultiSelectOption } from "../components/ui/MultiSelect";
import { RecencyService } from "../services/recency";
import { cn } from "../utils/cn";
import { useRepoContext } from "../contexts/RepoContext";

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

export function RepoList() {
    const { repos, projects, loading, error, filterRepos, refresh } = useRepositoryCache();
    const [search, setSearch] = useState("");
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
    const { clearContext } = useRepoContext();

    // Track loading state for specific actions by repo ID
    const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

    // Width for virtualization columns
    const windowWidth = useWindowWidth();
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(1200);

    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth);
        }
    }, [windowWidth, loading]);

    // Clear repo context when on repo list page
    useEffect(() => {
        clearContext();
    }, [clearContext]);

    const handleClone = async (e: React.MouseEvent, repo: GitRepository) => {
        e.preventDefault();
        e.stopPropagation();
        setActionLoading(prev => ({ ...prev, [repo.id]: "cloning" }));

        try {
            await cloneRepository(repo.project.name, repo.name, repo.webUrl);
            await refresh(); // Refresh cache to update isCloned status
        } catch (err: any) {
            console.error("Clone failed", err);
            alert(`Clone failed: ${err.message}`);
        } finally {
            setActionLoading(prev => {
                const newState = { ...prev };
                delete newState[repo.id];
                return newState;
            });
        }
    };

    const handleSync = async (e: React.MouseEvent, repo: GitRepository) => {
        e.preventDefault();
        e.stopPropagation();
        setActionLoading(prev => ({ ...prev, [repo.id]: "syncing" }));

        try {
            await syncRepository(repo.project.name, repo.name);
        } catch (err: any) {
            console.error("Sync failed", err);
            alert(`Sync failed: ${err.message}`);
        } finally {
            setActionLoading(prev => {
                const newState = { ...prev };
                delete newState[repo.id];
                return newState;
            });
        }
    };

    const handleRepoClick = (repo: GitRepository) => {
        RecencyService.track({
            id: `repo:${repo.id}`, // Consistent ID format
            label: repo.name,
            type: 'repo',
            path: `/repos/${repo.project.name}/${repo.name}`,
            meta: {
                project: repo.project.name,
                repo: repo.name
            }
        });
    };

    // Filtered Data
    const displayRepos = useMemo(() => {
        return filterRepos({ query: search, projects: selectedProjects });
    }, [search, selectedProjects, repos, filterRepos]);

    // Grid Calculation
    const gap = 16;
    const padding = 24; // p-6
    const minCardWidth = 350;
    // Calculate columns: available width / min width
    // But we usually want 1, 2, or 3 based on breakpoints
    // md:grid-cols-2 lg:grid-cols-3
    let columns = 1;
    if (windowWidth >= 1024) columns = 3;
    else if (windowWidth >= 768) columns = 2;

    const columnWidth = (containerWidth - (columns - 1) * gap) / columns;
    const rows = Math.ceil(displayRepos.length / columns);
    const rowHeight = 180; // Approximate card height

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const startIndex = index * columns;
        const items = displayRepos.slice(startIndex, startIndex + columns);

        return (
            <div style={{ ...style, display: 'flex', gap: gap }} className="pb-4">
                {items.map(repo => (
                    <div key={repo.id} style={{ width: columnWidth, height: '100%' }}>
                        <Link
                            to={`/repos/${repo.project.name}/${repo.name}`}
                            onClick={() => handleRepoClick(repo)}
                            className="block h-full"
                        >
                            <Card hoverable className="h-full flex flex-col justify-between group relative overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all duration-200">
                                <div>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-500 font-semibold px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 truncate max-w-[120px]">
                                                    {repo.project.name}
                                                </span>
                                                {repo.isCloned && (
                                                    <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
                                                        <Check className="w-3 h-3" /> Local
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate pr-2" title={repo.name}>
                                                {repo.name}
                                            </h3>
                                        </div>
                                    </div>
                                    {repo.project.description && (
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                            {repo.project.description}
                                        </p>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between text-xs text-zinc-500">
                                    <div className="flex items-center">
                                        <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                                        <span className="font-mono">{repo.defaultBranch?.replace('refs/heads/', '') || 'main'}</span>
                                    </div>

                                    <div className="flex items-center">
                                        {repo.isCloned ? (
                                            <button
                                                onClick={(e) => handleSync(e, repo)}
                                                disabled={!!actionLoading[repo.id]}
                                                className="p-2 hover:bg-blue-500/10 hover:text-blue-400 rounded-md transition-colors disabled:opacity-50"
                                                title="Sync Repository"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${actionLoading[repo.id] === 'syncing' ? 'animate-spin text-blue-500' : ''}`} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => handleClone(e, repo)}
                                                disabled={!!actionLoading[repo.id]}
                                                className="p-2 hover:bg-blue-500/10 hover:text-blue-400 rounded-md transition-colors disabled:opacity-50"
                                                title="Clone Repository"
                                            >
                                                {actionLoading[repo.id] === 'cloning' ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                                                ) : (
                                                    <Download className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    </div>
                ))}
            </div>
        );
    };

    if (loading) return <div className="flex justify-center items-center h-[50vh]"><Spinner /></div>;
    if (error) return <div className="p-8 text-red-400 bg-red-950/20 m-6 rounded-lg border border-red-900/50">Error: {error}</div>;

    return (
        <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-60px)] flex flex-col">
            <header className="flex-none mb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Repositories</h1>
                        <p className="text-zinc-500 dark:text-zinc-400">
                            {displayRepos.length} repositories across {projects.length} projects
                        </p>
                    </div>
                    {/* Controls */}
                    <div className="flex gap-2">
                        <MultiSelect
                            options={projects.map(p => ({ label: p, value: p }))}
                            selected={selectedProjects}
                            onChange={setSelectedProjects}
                            placeholder="Project"
                            className="w-48"
                            searchPlaceholder="Search projects..."
                        />
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                    <Input
                        placeholder="Search repositories (fuzzy) or projects..."
                        className="pl-10 h-10 text-lg bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 min-h-0" ref={containerRef}>
                {displayRepos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <Search className="w-12 h-12 mb-4 opacity-20" />
                        <p>No repositories found</p>
                    </div>
                ) : (
                    <List
                        height={Math.max(400, (containerRef.current?.clientHeight || 600))} // Use container height
                        itemCount={rows}
                        itemSize={rowHeight}
                        width={containerWidth}
                        className="scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
                    >
                        {Row}
                    </List>
                )}
            </div>
        </div>
    );
}

