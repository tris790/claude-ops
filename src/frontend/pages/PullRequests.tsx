import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPullRequests } from "../api/prs";
import {
    GitPullRequest,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronRight,
    GitBranch,
    User
} from "lucide-react";
import { cn } from "../utils/cn";

export function PullRequests() {
    const navigate = useNavigate();
    const [prs, setPrs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("active");

    useEffect(() => {
        loadPrs();
    }, [filter]);

    async function loadPrs() {
        setLoading(true);
        try {
            const data = await getPullRequests(filter);
            setPrs(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const getVoteIcon = (vote: number) => {
        if (vote > 0) return <CheckCircle2 className="h-3 w-3 text-emerald-500 fill-zinc-950" />;
        if (vote < 0) return <XCircle className="h-3 w-3 text-rose-500 fill-zinc-950" />;
        return <Clock className="h-3 w-3 text-zinc-500 fill-zinc-950" />;
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Pull Requests</h1>
                    <p className="text-zinc-500 text-sm mt-1">Review and manage code changes across repositories.</p>
                </div>
                <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    {["active", "completed", "abandoned"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                                filter === f ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </header>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="divide-y divide-zinc-800/30">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-4 animate-pulse flex items-center gap-4">
                                <div className="h-10 w-10 bg-zinc-800 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-zinc-800 rounded w-1/3" />
                                    <div className="h-3 bg-zinc-800 rounded w-1/4" />
                                </div>
                            </div>
                        ))
                    ) : prs.length > 0 ? (
                        prs.map((pr) => (
                            <div
                                key={pr.pullRequestId}
                                onClick={() => navigate(`/prs/${pr.pullRequestId}?repoId=${pr.repository.id}`)}
                                className="group p-4 hover:bg-white/5 transition-all flex items-center justify-between cursor-pointer"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <GitPullRequest className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-blue-400 transition-colors">
                                                {pr.title}
                                            </h3>
                                            <span className="text-xs text-zinc-500 font-mono">!{pr.pullRequestId}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3 text-zinc-600" />
                                                {pr.createdBy.displayName}
                                            </span>
                                            <span>in</span>
                                            <span className="flex items-center gap-1 text-zinc-400">
                                                <GitBranch className="h-3 w-3 text-zinc-600" />
                                                {pr.repository.name}
                                            </span>
                                            <span>•</span>
                                            <span>{new Date(pr.creationDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {pr.reviewers?.slice(0, 3).map((rev: any) => (
                                            <div key={rev.id} title={rev.displayName} className="h-7 w-7 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center relative">
                                                <span className="text-[10px] uppercase text-zinc-400">{rev.displayName[0]}</span>
                                                <div className="absolute -bottom-1 -right-1">
                                                    {getVoteIcon(rev.vote)}
                                                </div>
                                            </div>
                                        ))}
                                        {(pr.reviewers?.length || 0) > 3 && (
                                            <div className="h-7 w-7 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500">
                                                +{(pr.reviewers?.length || 0) - 3}
                                            </div>
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-12 text-center text-zinc-500">
                            <GitPullRequest className="h-12 w-12 mx-auto mb-4 text-zinc-800" />
                            <p>No pull requests found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
