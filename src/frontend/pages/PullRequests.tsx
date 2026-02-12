import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FixedSizeList as List } from "react-window";
import { usePullRequestCache } from "../hooks/usePullRequestCache";
import {
    GitPullRequest,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronRight,
    GitBranch,
    User,
    Search,
    X
} from "lucide-react";
import { cn } from "../utils/cn";
import { Input } from "../components/ui/Input";
import { MultiSelect } from "../components/ui/MultiSelect";
import type { MultiSelectOption } from "../components/ui/MultiSelect";

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

export function PullRequests() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");

    // -- Filtering State with Persistence --
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('claude-ops.prs.filter.statuses');
            return saved ? JSON.parse(saved) : ["active"];
        } catch { return ["active"]; }
    });

    const [selectedProjects, setSelectedProjects] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('claude-ops.prs.filter.projects');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [selectedRepos, setSelectedRepos] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('claude-ops.prs.filter.repos');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [selectedUsers, setSelectedUsers] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('claude-ops.prs.filter.users');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    // Save filters
    useEffect(() => { localStorage.setItem('claude-ops.prs.filter.statuses', JSON.stringify(selectedStatuses)); }, [selectedStatuses]);
    useEffect(() => { localStorage.setItem('claude-ops.prs.filter.projects', JSON.stringify(selectedProjects)); }, [selectedProjects]);
    useEffect(() => { localStorage.setItem('claude-ops.prs.filter.repos', JSON.stringify(selectedRepos)); }, [selectedRepos]);
    useEffect(() => { localStorage.setItem('claude-ops.prs.filter.users', JSON.stringify(selectedUsers)); }, [selectedUsers]);

    // Use the cache hook
    const { prs, loading, filterPrs, refresh } = usePullRequestCache(selectedStatuses.length > 0 ? selectedStatuses : ['active']);



    // -- Options Derivation --
    const options = useMemo(() => {
        const projects = new Map<string, number>();
        const repos = new Map<string, { label: string, count: number }>();
        const users = new Map<string, { label: string, count: number }>();

        prs.forEach(pr => {
            // Project
            const projName = pr.repository.project.name;
            if (projName) projects.set(projName, (projects.get(projName) || 0) + 1);

            // Repo
            const repoId = pr.repository.id;
            const repoName = pr.repository.name;
            const existingRepo = repos.get(repoId);
            repos.set(repoId, { label: repoName, count: (existingRepo?.count || 0) + 1 });

            // User
            const user = pr.createdBy;
            const userKey = user.uniqueName || user.displayName;
            const existingUser = users.get(userKey);
            users.set(userKey, { label: user.displayName, count: (existingUser?.count || 0) + 1 });
        });

        return {
            statuses: [
                { label: "Active", value: "active" },
                { label: "Completed", value: "completed" },
                { label: "Abandoned", value: "abandoned" }
            ],
            projects: Array.from(projects.entries()).map(([val, count]): MultiSelectOption => ({ label: val, value: val, count })).sort((a, b) => a.label.localeCompare(b.label)),
            repos: Array.from(repos.entries()).map(([val, { label, count }]): MultiSelectOption => ({ label, value: val, count })).sort((a, b) => a.label.localeCompare(b.label)),
            users: Array.from(users.entries()).map(([val, { label, count }]): MultiSelectOption => ({ label, value: val, count })).sort((a, b) => a.label.localeCompare(b.label))
        };
    }, [prs]);

    // Filtered Data
    const displayPrs = useMemo(() => {
        return filterPrs({
            query: searchQuery,
            repositoryIds: selectedRepos,
            authorIds: selectedUsers,
            projectNames: selectedProjects
        });
    }, [searchQuery, prs, filterPrs, selectedRepos, selectedUsers, selectedProjects]);

    const getVoteIcon = (vote: number) => {
        if (vote > 0) return <CheckCircle2 className="h-3 w-3 text-emerald-500 fill-white dark:fill-zinc-950" />;
        if (vote < 0) return <XCircle className="h-3 w-3 text-rose-500 fill-white dark:fill-zinc-950" />;
        return <Clock className="h-3 w-3 text-zinc-500 fill-white dark:fill-zinc-950" />;
    };

    // Virtualization setup
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

    // Row Component
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const pr = displayPrs[index];
        return (
            <div style={style}>
                <div
                    onClick={() => navigate(`/prs/${pr.pullRequestId}?repoId=${pr.repository.id}`)}
                    className="group mx-2 mt-2 p-4 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all flex items-center justify-between cursor-pointer rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                            <GitPullRequest className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {pr.title}
                                </h3>
                                <span className="text-xs text-zinc-500 font-mono shrink-0">!{pr.pullRequestId}</span>
                                {pr.status === "completed" && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-medium uppercase tracking-wider">Merged</span>}
                                {pr.status === "abandoned" && <span className="px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-500 text-[10px] font-medium uppercase tracking-wider">Abandoned</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 truncate">
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />
                                    {pr.createdBy.displayName}
                                </span>
                                <span>in</span>
                                <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                                    <GitBranch className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />
                                    {pr.repository.name}
                                </span>
                                <span>•</span>
                                <span>{new Date(pr.creationDate).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pl-4 shrink-0">
                        <div className="flex -space-x-2 overflow-hidden">
                            {pr.reviewers?.slice(0, 3).map((rev: any) => (
                                <div key={rev.id} title={rev.displayName} className="h-7 w-7 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative">
                                    <span className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400">{rev.displayName[0]}</span>
                                    <div className="absolute -bottom-1 -right-1">
                                        {getVoteIcon(rev.vote)}
                                    </div>
                                </div>
                            ))}
                            {(pr.reviewers?.length || 0) > 3 && (
                                <div className="h-7 w-7 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 dark:text-zinc-400">
                                    +{(pr.reviewers?.length || 0) - 3}
                                </div>
                            )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-60px)] flex flex-col space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Pull Requests</h1>
                    <p className="text-zinc-500 text-sm mt-1">Review and manage code changes across repositories.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                        <Input
                            placeholder="Search PRs..."
                            className="pl-9 h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
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

                    <div className="flex items-center gap-2">
                        <MultiSelect
                            options={options.users}
                            selected={selectedUsers}
                            onChange={setSelectedUsers}
                            placeholder="User"
                            className="w-36 md:w-48"
                            searchPlaceholder="Search authors..."
                        />
                        <MultiSelect
                            options={options.repos}
                            selected={selectedRepos}
                            onChange={setSelectedRepos}
                            placeholder="Repo"
                            className="w-32 md:w-40"
                            searchPlaceholder="Search repositories..."
                        />
                        <MultiSelect
                            options={options.projects}
                            selected={selectedProjects}
                            onChange={setSelectedProjects}
                            placeholder="Project"
                            className="w-32 md:w-40"
                            searchPlaceholder="Search projects..."
                        />
                        <MultiSelect
                            options={options.statuses}
                            selected={selectedStatuses}
                            onChange={setSelectedStatuses}
                            placeholder="Status"
                            className="w-32 md:w-40"
                        />
                    </div>
                </div>
            </header>

            <div className="flex-1 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm relative" ref={containerRef}>
                {loading && !prs.length ? (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-4 animate-pulse flex items-center gap-4">
                                <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                                    <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : displayPrs.length > 0 ? (
                    <List
                        height={containerHeight}
                        itemCount={displayPrs.length}
                        itemSize={88} // Approximate height with padding
                        width={containerWidth}
                        className="scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent divide-y divide-zinc-200 dark:divide-zinc-800/30"
                    >
                        {Row}
                    </List>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-center">
                        <GitPullRequest className="h-12 w-12 mb-4 text-zinc-300 dark:text-zinc-800" />
                        <p>No pull requests found.</p>
                        {(selectedStatuses.length > 0 || selectedProjects.length > 0 || selectedRepos.length > 0 || selectedUsers.length > 0) && (
                            <button
                                onClick={() => {
                                    setSelectedStatuses(["active"]);
                                    setSelectedProjects([]);
                                    setSelectedRepos([]);
                                    setSelectedUsers([]);
                                    setSearchQuery("");
                                }}
                                className="mt-4 text-xs text-blue-500 hover:underline"
                            >
                                Reset all filters
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

