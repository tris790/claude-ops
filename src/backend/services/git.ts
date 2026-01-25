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

        const proc = Bun.spawn(["git", "clone", "--depth", "1", cloneUrl, targetPath], {
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

    async listFiles(projectName: string, repoName: string, path: string = "/"): Promise<any[]> {
        const repoPath = this.getRepoPath(projectName, repoName);
        if (!(await this.isCloned(projectName, repoName))) {
            throw new Error("Repository not cloned");
        }

        // Normalize path. removing leading slash
        const relPath = path.replace(/^\//, "");
        const gitObj = relPath ? `HEAD:${relPath}` : "HEAD";

        try {
            const proc = Bun.spawn(["git", "ls-tree", gitObj], {
                cwd: repoPath,
                stdout: "pipe",
                stderr: "pipe",
            });

            const exitCode = await proc.exited;
            if (exitCode !== 0) {
                return [];
            }

            const output = await new Response(proc.stdout).text();

            return output.trim().split("\n").filter(Boolean).map(line => {
                const parts = line.split("\t");
                if (parts.length < 2) return null;
                const [meta, name] = parts;
                const [mode, type, object] = meta.split(" ");

                return {
                    objectId: object,
                    gitObjectType: type, // "blob" or "tree"
                    commitId: "HEAD",
                    path: relPath ? `/${relPath}/${name}` : `/${name}`,
                    url: ""
                };
            }).filter(Boolean);

        } catch (e) {
            console.error("git listFiles error", e);
            throw e;
        }
    }

    async getFileContent(projectName: string, repoName: string, path: string): Promise<string> {
        const repoPath = this.getRepoPath(projectName, repoName);
        if (!(await this.isCloned(projectName, repoName))) {
            throw new Error("Repository not cloned");
        }

        const relPath = path.replace(/^\//, "");

        const proc = Bun.spawn(["git", "show", `HEAD:${relPath}`], {
            cwd: repoPath,
            stdout: "pipe",
            stderr: "pipe"
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text();
            throw new Error(`Failed to get file content: ${stderr}`);
        }

        return await new Response(proc.stdout).text();
    }

    async search(projectName: string, repoName: string, query: string): Promise<any[]> {
        const repoPath = this.getRepoPath(projectName, repoName);
        if (!(await this.isCloned(projectName, repoName))) {
            return [];
        }

        try {
            // git grep -n -I <query> HEAD
            const proc = Bun.spawn(["git", "grep", "-n", "-I", query, "HEAD"], {
                cwd: repoPath,
                stdout: "pipe",
                stderr: "pipe"
            });

            const exitCode = await proc.exited;
            if (exitCode !== 0) {
                // Determine if it was "not found" (exit code 1) or error (exit code > 1)
                // git grep returns 1 if not found.
                return [];
            }

            const output = await new Response(proc.stdout).text();
            // Output format: HEAD:path/to/file:lineNumber:content

            return output.trim().split("\n").map(line => {
                // Split by colon, limiting to 4 parts to keep content intact
                // HEAD : path : line : content
                // But path might have colons? unlikely in git paths but possible.
                // git grep -n output is generally consistent.

                // We can strip HEAD: prefix first
                const cleanLine = line.replace(/^HEAD:/, "");

                // Now path:line:content
                // Find first colon
                const firstColon = cleanLine.indexOf(":");
                if (firstColon === -1) return null;

                const path = cleanLine.substring(0, firstColon);
                const rest = cleanLine.substring(firstColon + 1);

                const secondColon = rest.indexOf(":");
                if (secondColon === -1) return null;

                const lineNumber = rest.substring(0, secondColon);
                const content = rest.substring(secondColon + 1);

                return {
                    file: path,
                    line: parseInt(lineNumber, 10),
                    content: content
                };
            }).filter(Boolean);

        } catch (e) {
            console.error("Search error:", e);
            return [];
        }
    }
}

export const gitService = new GitService();
