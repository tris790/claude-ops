import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, GitBranch } from "lucide-react";
import { getRepositories, type GitRepository } from "../api/repos";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";

export function RepoList() {
    const [repos, setRepos] = useState<GitRepository[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    useEffect(() => {
        getRepositories()
            .then(setRepos)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const filteredRepos = repos.filter(repo =>
        repo.name.toLowerCase().includes(search.toLowerCase()) ||
        repo.project.name.toLowerCase().includes(search.toLowerCase())
    );

    const groupedRepos = filteredRepos.reduce((acc, repo) => {
        const project = repo.project.name;
        if (!acc[project]) acc[project] = [];
        acc[project].push(repo);
        return acc;
    }, {} as Record<string, GitRepository[]>);

    const sortedProjectEntries = Object.entries(groupedRepos).sort(([a], [b]) => a.localeCompare(b));

    if (loading) return <div className="flex justify-center items-center h-full p-8"><Spinner /></div>;
    if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Repositories</h1>
                <p className="text-zinc-400 mb-6">Browse and manage repositories across your organization.</p>
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Filter repositories..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </header>

            <div className="space-y-8">
                {sortedProjectEntries.map(([project, projectRepos]) => (
                    <section key={project}>
                        <h2 className="text-lg font-semibold text-blue-500 mb-4 px-1 sticky top-0 bg-transparent backdrop-blur-xl pb-2 pt-2 z-10 border-b border-zinc-800/50 inline-block rounded-lg">
                            {project}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projectRepos.map(repo => (
                                <Link key={repo.id} to={`/repos/${repo.project.name}/${repo.name}`}>
                                    <Card hoverable className="h-full flex flex-col justify-between group">
                                        <div>
                                            <div className="flex items-start justify-between">
                                                <h3 className="font-medium text-zinc-200 group-hover:text-blue-400 transition-colors">
                                                    {repo.name}
                                                </h3>
                                            </div>
                                            {/* Note: Azure DevOps repo objects don't typically have descriptions directly, 
                                                but we check if it exists just in case or if we augment it later */}
                                            {repo.project.description && (
                                                <p className="text-sm text-zinc-500 mt-2 line-clamp-2">
                                                    {repo.project.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="mt-4 flex items-center text-xs text-zinc-500 space-x-4">
                                            <div className="flex items-center">
                                                <GitBranch className="w-3 h-3 mr-1" />
                                                {repo.defaultBranch?.replace('refs/heads/', '') || 'main'}
                                            </div>
                                            <div className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                Remote Only
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            {filteredRepos.length === 0 && (
                <div className="text-center py-12 text-zinc-500">
                    No repositories found matching "{search}"
                </div>
            )}
        </div>
    );
}
