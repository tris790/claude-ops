import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { FileTree } from "../components/repo/FileTree";
import { Breadcrumbs } from "../components/repo/Breadcrumbs";
import { FileViewer } from "../components/repo/FileViewer";
import { getRepositories, getBranches, type GitItem, type GitRepository } from "../api/repos";
import { ReferencesPanel, type LSPLocation } from "../components/lsp/ReferencesPanel";
import { handleLSPDefinition } from "../features/lsp/navigation";
import { MultiSelect } from "../components/ui/MultiSelect";
import { ResizablePanel } from "../components/ui/ResizablePanel";
import { useRepoContext } from "../contexts/RepoContext";
import { getLspLanguageFromPath } from "../features/lsp/language-map";

export function RepoBrowser() {
    const { project, repo, "*": splat } = useParams<{ project: string; repo: string; "*": string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const scrollToLine = searchParams.get("line") ? parseInt(searchParams.get("line")!, 10) : null;

    const [selectedFile, setSelectedFile] = useState<GitItem | null>(null);
    const [gitRepo, setGitRepo] = useState<GitRepository | null>(null);
    const [allRepos, setAllRepos] = useState<GitRepository[]>([]);
    const [branches, setBranches] = useState<{ name: string; objectId: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // LSP References State
    const [references, setReferences] = useState<LSPLocation[]>([]);
    const [referencesLoading, setReferencesLoading] = useState(false);
    const [showReferences, setShowReferences] = useState(false);

    const { setContext, clearContext } = useRepoContext();

    useEffect(() => {
        if (!project || !repo) {
            clearContext();
            return;
        }

        getRepositories()
            .then(repos => {
                setAllRepos(repos);
                const found = repos.find(r => r.project.name === project && r.name === repo);
                if (found) {
                    setGitRepo(found);
                    return getBranches(found.id);
                } else {
                    throw new Error("Repository not found");
                }
            })
            .then(b => {
                if (b) setBranches(b);
            })
            .catch(err => {
                console.error(err);
                setError(err.message || "Failed to load repository details");
            })
            .finally(() => setLoading(false));
    }, [project, repo, clearContext]);

    const { currentBranch, filePath } = useMemo(() => {
        if (!splat || !gitRepo) return { currentBranch: (gitRepo?.defaultBranch || "main").replace("refs/heads/", ""), filePath: "" };

        // Normalize: remove common ref prefixes
        let normalizedSplat = splat;
        if (normalizedSplat.startsWith("refs/heads/")) {
            normalizedSplat = normalizedSplat.slice(11);
        } else if (normalizedSplat.startsWith("heads/")) {
            normalizedSplat = normalizedSplat.slice(6);
        }

        // Try to find the longest branch name that matches the start of splat
        const sortedBranches = [...branches].sort((a, b) => b.name.length - a.name.length);
        for (const b of sortedBranches) {
            if (normalizedSplat === b.name) return { currentBranch: b.name, filePath: "" };
            if (normalizedSplat.startsWith(b.name + "/")) {
                return { currentBranch: b.name, filePath: normalizedSplat.slice(b.name.length + 1) };
            }
        }

        // Fallback: first segment is branch
        const parts = normalizedSplat.split("/");
        return { currentBranch: parts[0] || "main", filePath: parts.slice(1).join("/") };
    }, [splat, branches, gitRepo]);

    // Update context when repo/branch/file changes
    useEffect(() => {
        if (project && repo && currentBranch) {
            const language = selectedFile ? getLspLanguageFromPath(selectedFile.path) : null;
            setContext({
                project,
                repo,
                branch: currentBranch,
                file: selectedFile?.path || null,
                language,
            });
        }
    }, [project, repo, currentBranch, selectedFile, setContext]);

    // Sync state from URL
    useEffect(() => {
        if (gitRepo && filePath) {
            // If path is provided in URL but no selectedFile or path mismatch
            if (!selectedFile || selectedFile.path !== filePath) {
                setSelectedFile({
                    path: filePath,
                    gitObjectType: "blob",
                    objectId: "",
                    commitId: "",
                    url: ""
                });
            }
        } else if (gitRepo && !filePath) {
            setSelectedFile(null);
        }
    }, [gitRepo, filePath]);

    const handleFileSelect = (item: GitItem) => {
        setSelectedFile(item);
        navigate(`/repos/${project}/${repo}/blob/${currentBranch}/${item.path}`);
    };

    const handleBranchChange = (newBranch: string) => {
        navigate(`/repos/${project}/${repo}/blob/${newBranch}/${filePath}`);
    };

    const handleRepoChange = (repoId: string) => {
        const found = allRepos.find(r => r.id === repoId);
        if (found) {
            navigate(`/repos/${found.project.name}/${found.name}`);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center text-zinc-500">Loading...</div>;
    if (error) return <div className="h-full flex items-center justify-center text-red-500">{error}</div>;
    if (!gitRepo) return null;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 w-full ml-0">
            <Breadcrumbs project={project!} repo={repo!} path={selectedFile?.path} />
            <div className="flex-1 flex overflow-hidden">
                <ResizablePanel
                    direction="horizontal"
                    defaultSize={300}
                    minSize={60}
                    maxSize={500}
                    storageKey="repo-browser-file-tree-width"
                    className="border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 flex flex-col shrink-0"
                >
                    <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2 shrink-0">
                        <MultiSelect
                            multiple={false}
                            options={allRepos.map(r => ({ label: r.name, value: r.id, count: r.project.name === project ? undefined : 0 }))}
                            selected={gitRepo.id}
                            onChange={(val) => handleRepoChange(val)}
                            placeholder="Select Repository"
                            className="w-full"
                            searchPlaceholder="Search repositories..."
                        />
                        <MultiSelect
                            multiple={false}
                            options={branches.map(b => ({ label: b.name, value: b.name }))}
                            selected={currentBranch}
                            onChange={(val) => handleBranchChange(val)}
                            placeholder="Select Branch"
                            className="w-full"
                            searchPlaceholder="Search branches..."
                        />
                    </div>
                    <FileTree
                        repoId={gitRepo.id}
                        onSelect={handleFileSelect}
                        activePath={selectedFile?.path}
                        branch={currentBranch}
                    />
                </ResizablePanel>
                <div className="flex-1 bg-white dark:bg-zinc-950/50 flex flex-col overflow-hidden">
                    {selectedFile ? (
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            <FileViewer
                                repoId={gitRepo.id}
                                file={selectedFile}
                                projectName={gitRepo.project.name}
                                repoName={gitRepo.name}
                                isCloned={!!gitRepo.isCloned}
                                branch={currentBranch}
                                scrollToLine={scrollToLine}
                                onFindReferences={(refs, loading) => {
                                    setReferences(refs);
                                    setReferencesLoading(loading);
                                    setShowReferences(true);
                                }}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-600">
                            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 dark:text-zinc-700"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                            </div>
                            <p>Select a file to view its contents in {currentBranch}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* References Panel */}
            {showReferences && (
                <div className="relative z-40 shrink-0">
                    <ReferencesPanel
                        references={references}
                        repoId={gitRepo.id}
                        repoName={gitRepo.name}
                        projectName={gitRepo.project.name}
                        version={currentBranch}
                        isLoading={referencesLoading}
                        onClose={() => setShowReferences(false)}
                        onSelect={(loc: LSPLocation) => {
                            handleLSPDefinition(loc, {
                                projectName: gitRepo.project.name,
                                repoName: gitRepo.name,
                                branch: currentBranch
                            }, navigate);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
