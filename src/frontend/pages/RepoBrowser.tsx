import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { FileTree } from "../components/repo/FileTree";
import { Breadcrumbs } from "../components/repo/Breadcrumbs";
import { FileViewer } from "../components/repo/FileViewer";
import { getRepositories, type GitItem, type GitRepository } from "../api/repos";

export function RepoBrowser() {
    const { project, repo } = useParams<{ project: string; repo: string }>();
    const [selectedFile, setSelectedFile] = useState<GitItem | null>(null);
    const [gitRepo, setGitRepo] = useState<GitRepository | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!project || !repo) return;

        getRepositories()
            .then(repos => {
                const found = repos.find(r => r.project.name === project && r.name === repo);
                if (found) {
                    setGitRepo(found);
                } else {
                    setError("Repository not found");
                }
            })
            .catch(err => {
                console.error(err);
                setError("Failed to load repository details");
            })
            .finally(() => setLoading(false));
    }, [project, repo]);

    if (loading) return <div className="h-full flex items-center justify-center text-zinc-500">Loading...</div>;
    if (error) return <div className="h-full flex items-center justify-center text-red-500">{error}</div>;
    if (!gitRepo) return null;

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800 w-full ml-0">
            <Breadcrumbs project={project!} repo={repo!} path={selectedFile?.path} />
            <div className="flex-1 flex overflow-hidden">
                <div className="w-[300px] border-r border-zinc-800 bg-zinc-900/30 flex flex-col shrink-0">
                    <FileTree
                        repoId={gitRepo.id}
                        onSelect={setSelectedFile}
                        activePath={selectedFile?.path}
                    />
                </div>
                <div className="flex-1 bg-zinc-950/50 flex flex-col overflow-hidden">
                    {selectedFile ? (
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            <FileViewer
                                repoId={gitRepo.id}
                                file={selectedFile}
                                projectName={gitRepo.project.name}
                                repoName={gitRepo.name}
                                isCloned={!!gitRepo.isCloned}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-700"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                            </div>
                            <p>Select a file to view its contents</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
