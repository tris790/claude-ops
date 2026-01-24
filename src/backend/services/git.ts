import { join } from "path";
import { homedir } from "os";
import { mkdir, readdir, stat } from "fs/promises";

export interface ClonedRepo {
    project: string;
    repo: string;
}

const REPOS_DIR = join(homedir(), ".claude-ops", "repos");

export class GitService {
    private baseDir: string;

    constructor(baseDir?: string) {
        this.baseDir = baseDir || REPOS_DIR;
    }

    getBaseDir() {
        return this.baseDir;
    }

    getRepoPath(projectName: string, repoName: string) {
        return join(this.baseDir, projectName, repoName);
    }

    async ensureBaseDir() {
        await mkdir(this.baseDir, { recursive: true });
    }

    async isCloned(projectName: string, repoName: string) {
        const gitDir = join(this.getRepoPath(projectName, repoName), ".git");
        try {
            await stat(gitDir);
            return true;
        } catch {
            return false;
        }
    }

    async listClonedRepos(): Promise<ClonedRepo[]> {
        try {
            await stat(this.baseDir);
        } catch {
            return [];
        }

        const repos: ClonedRepo[] = [];

        try {
            const projects = await readdir(this.baseDir);
            for (const project of projects) {
                const projectPath = join(this.baseDir, project);
                try {
                    if ((await stat(projectPath)).isDirectory()) {
                        const repoDirs = await readdir(projectPath);
                        for (const repo of repoDirs) {
                            const repoPath = join(projectPath, repo);
                            try {
                                if ((await stat(repoPath)).isDirectory()) {
                                    // Check for .git
                                    const gitPath = join(repoPath, ".git");
                                    await stat(gitPath); // throws if not exists
                                    repos.push({ project, repo });
                                }
                            } catch {
                                // Not a git repo or not a dir
                            }
                        }
                    }
                } catch {
                    // Not a dir
                }
            }
        } catch (error) {
            // Directory error
        }
        return repos;
    }

    async clone(projectName: string, repoName: string, cloneUrl: string) {
        await this.ensureBaseDir();

        const projectDir = join(this.baseDir, projectName);
        await mkdir(projectDir, { recursive: true });

        const targetPath = this.getRepoPath(projectName, repoName);

        const proc = Bun.spawn(["git", "clone", cloneUrl, targetPath], {
            stdout: "pipe",
            stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text();
            throw new Error(`Git clone failed: ${stderr}`);
        }
    }

    async fetch(projectName: string, repoName: string) {
        const path = this.getRepoPath(projectName, repoName);

        if (!(await this.isCloned(projectName, repoName))) {
            return;
        }

        const proc = Bun.spawn(["git", "fetch"], {
            cwd: path,
            stdout: "ignore",
            stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text();
            throw new Error(`Git fetch failed: ${stderr}`);
        }
    }

    async fetchAll() {
        const repos = await this.listClonedRepos();
        await Promise.allSettled(repos.map(r => this.fetch(r.project, r.repo)));
    }

    async getStatus(projectName: string, repoName: string) {
        const path = this.getRepoPath(projectName, repoName);
        if (!(await this.isCloned(projectName, repoName))) {
            return null;
        }

        const proc = Bun.spawn(["git", "rev-list", "--left-right", "--count", "HEAD...@{u}"], {
            cwd: path,
            stdout: "pipe",
            stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            return { ahead: 0, behind: 0 };
        }

        const output = await new Response(proc.stdout).text();
        const parts = output.trim().split(/\s+/);
        if (parts.length === 2 && parts[0] && parts[1]) {
            return {
                ahead: parseInt(parts[0], 10),
                behind: parseInt(parts[1], 10)
            };
        }
        return { ahead: 0, behind: 0 };
    }
    async pull(projectName: string, repoName: string) {
        const path = this.getRepoPath(projectName, repoName);

        if (!(await this.isCloned(projectName, repoName))) {
            throw new Error("Repository is not cloned locally");
        }

        const proc = Bun.spawn(["git", "pull"], {
            cwd: path,
            stdout: "pipe",
            stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text();
            throw new Error(`Git pull failed: ${stderr}`);
        }
    }
}

export const gitService = new GitService();
