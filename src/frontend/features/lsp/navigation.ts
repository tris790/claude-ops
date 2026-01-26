import type { NavigateFunction } from "react-router-dom";

/**
 * Options for LSP navigation logic
 */
export interface NavigationOptions {
    projectName: string;
    repoName: string;
    pullRequestId?: string;
    /**
     * List of file paths modified in the current PR.
     * Paths should be relative to repo root, e.g. "/src/app.ts"
     */
    modifiedFiles?: string[];
    /**
     * Target branch or commit for non-PR navigation.
     */
    branch?: string;
}

/**
 * Handles textDocument/definition results and routes to the correct view.
 * 
 * Logic:
 * 1. Scenario A (File in PR): If the file path corresponds to a file modified in the PR:
 *    - Navigate to the PR Diff View page.
 *    - Scroll to the specific line.
 * 2. Scenario B (File Unchanged/Not in PR context): 
 *    - Navigate to the File Browser page.
 *    - Open the file at the specific line.
 */
export function handleLSPDefinition(
    location: any,
    options: NavigationOptions,
    navigate: NavigateFunction
): boolean {
    if (!location) return false;

    const loc = Array.isArray(location) ? location[0] : location;
    const targetUri = 'uri' in loc ? loc.uri : (loc as any).targetUri;
    const range = 'range' in loc ? loc.range : (loc as any).targetSelectionRange;

    if (!targetUri || !range) return false;

    // Standardize path: remove file:/// and redundant prefixes
    let targetPath = targetUri.startsWith("file:///") ? targetUri.slice(8) : targetUri;

    // Remove virtual prefixes added by DiffViewer if present
    if (targetPath.startsWith("original/")) targetPath = targetPath.slice(9);
    else if (targetPath.startsWith("modified/")) targetPath = targetPath.slice(9);

    // Ensure leading slash for consistency with Azure DevOps paths
    if (!targetPath.startsWith("/")) {
        targetPath = "/" + targetPath;
    }

    const line = range.start.line + 1;
    // We don't use character yet in URL but it's available in range.start.character

    // Scenario A: File is modified in the PR
    if (options.pullRequestId && options.modifiedFiles) {
        // Find matching path. Some paths might not have leading slash or vice versa.
        const isModified = options.modifiedFiles.some(p => {
            const normalizedP = p.startsWith('/') ? p : '/' + p;
            return normalizedP === targetPath;
        });

        if (isModified) {
            navigate(`/pr/${options.pullRequestId}?tab=files&path=${encodeURIComponent(targetPath)}&line=${line}`);
            return true;
        }
    }

    // Scenario B: File Unchanged (or not in PR context)
    const branch = options.branch || "main";
    navigate(`/repos/${options.projectName}/${options.repoName}/blob/${branch}${targetPath}?line=${line}`);
    return true;
}
