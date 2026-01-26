import { gitService } from "../git";

export class GitContextManager {

    /**
     * Ensures the local repository is checked out to the specified commit.
     * Used for setting context for LSP and file viewing.
     */
    async ensureCommit(projectName: string, repoName: string, commitHash: string): Promise<{ success: boolean; error?: string }> {
        // 1. Verify Repo Logic
        const isCloned = await gitService.isCloned(projectName, repoName);
        if (!isCloned) {
            return { success: false, error: "Repository is not cloned locally." };
        }

        const repoPath = gitService.getRepoPath(projectName, repoName);

        // 2. Check Dirty State
        const dirty = await this.isDirty(repoPath);
        if (dirty) {
            return {
                success: false,
                error: "Repository has uncommitted changes. Please commit or stash them before switching context."
            };
        }

        // 3. Check if already on the correct commit
        const currentHead = await this.getCurrentHead(repoPath);
        if (currentHead === commitHash || currentHead.startsWith(commitHash)) {
            return { success: true };
        }

        // 4. Attempt Checkout
        try {
            try {
                // Optimistic attempt: assume we have the commit locally
                await this.checkout(repoPath, commitHash);
            } catch (checkoutError) {
                // 4b. Missing Commit / Shallow Clone Scenario
                // If the checkout fails, it is likely because the commit does not exist 
                // in the local shallow clone. We must fetch the SPECIFIC hash from origin.
                await this.fetch(repoPath, commitHash);

                // Retry checkout after fetch
                await this.checkout(repoPath, commitHash);
            }

            // 5. Validation
            const newHead = await this.getCurrentHead(repoPath);
            if (!newHead.startsWith(commitHash)) {
                return { success: false, error: `Checkout validation failed. Expected ${commitHash}, got ${newHead}` };
            }

            return { success: true };

        } catch (error: any) {
            return { success: false, error: `Failed to checkout commit ${commitHash}: ${error.message}` };
        }
    }

    private async isDirty(repoPath: string): Promise<boolean> {
        const proc = Bun.spawn(["git", "status", "--porcelain"], {
            cwd: repoPath,
            stdout: "pipe",
            stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            throw new Error("Failed to check git status");
        }

        const output = await new Response(proc.stdout).text();
        return output.trim().length > 0;
    }

    private async getCurrentHead(repoPath: string): Promise<string> {
        const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
            cwd: repoPath,
            stdout: "pipe",
            stderr: "pipe",
        });

        const output = await new Response(proc.stdout).text();
        return output.trim();
    }

    /**
     * Fetches updates. If a commitHash is provided, it specifically fetches that hash
     * from origin. This is required for shallow clones to access older history or 
     * remote branches without unshallowing the whole repo.
     */
    private async fetch(repoPath: string, commitHash?: string): Promise<void> {
        const args = ["git", "fetch", "origin"];

        if (commitHash) {
            // Fetch the specific commit object.
            // This works on most modern git servers (GitHub/GitLab) even if the 
            // commit isn't the tip of a branch.
            args.push(commitHash);
        }

        const proc = Bun.spawn(args, {
            cwd: repoPath,
            stdout: "ignore",
            stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text();
            throw new Error(`Fetch failed: ${stderr}`);
        }
    }

    private async checkout(repoPath: string, commitHash: string): Promise<void> {
        // Detached HEAD is expected and fine for this use case
        const proc = Bun.spawn(["git", "checkout", commitHash], {
            cwd: repoPath,
            stdout: "ignore",
            stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text();
            throw new Error(stderr);
        }
    }
}

export const gitContextManager = new GitContextManager();