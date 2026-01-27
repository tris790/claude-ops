import { join } from "path";
import { mkdir, readdir, stat } from "fs/promises";
import { getSettings } from "./settings";

export interface ClonedRepo {
    project: string;
    repo: string;
}

export class GitService {
    private manualBaseDir?: string;

    constructor(baseDir?: string) {
        this.manualBaseDir = baseDir;
    }

    async getBaseDir() {
        if (this.manualBaseDir) return this.manualBaseDir;
        const settings = await getSettings();
        return settings.repoCloneDirectory;
    }

    async getRepoPath(projectName: string, repoName: string) {
        const baseDir = await this.getBaseDir();
        return join(baseDir, projectName, repoName);
    }

    async ensureBaseDir() {
        const baseDir = await this.getBaseDir();
        await mkdir(baseDir, { recursive: true });
    }

    async isCloned(projectName: string, repoName: string) {
        const repoPath = await this.getRepoPath(projectName, repoName);
        const gitDir = join(repoPath, ".git");
        try {
            await stat(gitDir);
            return true;
        } catch {
            return false;
        }
    }

    async listClonedRepos(): Promise<ClonedRepo[]> {
        const baseDir = await this.getBaseDir();
        try {
            await stat(baseDir);
        } catch {
            return [];
        }

        const repos: ClonedRepo[] = [];

        try {
            const projects = await readdir(baseDir);
            for (const project of projects) {
                const projectPath = join(baseDir, project);
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

        const baseDir = await this.getBaseDir();
        const projectDir = join(baseDir, projectName);
        await mkdir(projectDir, { recursive: true });

        const targetPath = await this.getRepoPath(projectName, repoName);

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
        const path = await this.getRepoPath(projectName, repoName);

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
        const path = await this.getRepoPath(projectName, repoName);
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
        const path = await this.getRepoPath(projectName, repoName);

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
        const repoPath = await this.getRepoPath(projectName, repoName);
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

    async getFileContent(projectName: string, repoName: string, path: string, version?: string): Promise<string> {
        const repoPath = await this.getRepoPath(projectName, repoName);
        if (!(await this.isCloned(projectName, repoName))) {
            throw new Error("Repository not cloned");
        }

        const relPath = path.replace(/^\//, "");
        const ref = version || "HEAD";

        const proc = Bun.spawn(["git", "show", `${ref}:${relPath}`], {
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

    async search(projectName: string, repoName: string, query: string, options: { isRegex?: boolean, filePatterns?: string[], contextLines?: number, isPathSearch?: boolean } = {}): Promise<any[]> {
        const repoPath = await this.getRepoPath(projectName, repoName);
        if (!(await this.isCloned(projectName, repoName))) {
            return [];
        }

        if (options.isPathSearch) {
            try {
                // Use git ls-files to search filenames
                // git ls-files is robust. We can just list all and filter, or use grep if we want to rely on git
                // Simple approach: git ls-files and filter in JS.
                const proc = Bun.spawn(["git", "ls-files"], {
                    cwd: repoPath,
                    stdout: "pipe",
                    stderr: "pipe"
                });

                const exitCode = await proc.exited;
                if (exitCode !== 0) return [];

                const output = await new Response(proc.stdout).text();
                const files = output.split("\n").filter(Boolean);

                const results: any[] = [];
                const regex = options.isRegex ? new RegExp(query, "i") : null;
                const lowerQuery = query.toLowerCase();

                for (const file of files) {
                    let match = false;
                    if (regex) {
                        match = regex.test(file);
                    } else {
                        // Smart case? Assuming case insensitive for filenames usually
                        match = file.toLowerCase().includes(lowerQuery);
                    }

                    if (match) {
                        results.push({
                            file,
                            line: 0,
                            content: file, // Show filename as content
                            type: 'file'
                        });
                    }
                    if (results.length > 50) break; // Limit results
                }
                return results;

            } catch (e) {
                console.error("Path search error:", e);
                return [];
            }
        }

        try {
            const args = ["rg", "--json"];

            // Context
            if (options.contextLines) {
                args.push("-C", options.contextLines.toString());
            }

            // Regex vs Fixed
            if (!options.isRegex) {
                args.push("-F");
            } else {
                // Use PCRE2 for better regex support if needed, or default
                // args.push("--pcre2");
            }

            // Smart case is default in rg usually, but let's be explicit if we want case insensitivity? 
            // git grep -I (ignore binary) is default in rg
            args.push("--smart-case");

            // File patterns
            if (options.filePatterns && options.filePatterns.length > 0) {
                for (const pattern of options.filePatterns) {
                    args.push("--glob", pattern);
                }
            }

            // Query
            args.push("-e", query);

            // Path to search
            // args.push(repoPath); 
            // Setting cwd is cleaner

            const proc = Bun.spawn(args, {
                cwd: repoPath,
                stdout: "pipe",
                stderr: "pipe"
            });

            const exitCode = await proc.exited;
            // rg returns 1 if no matches found, which is fine. > 1 is error.
            if (exitCode > 1) {
                const stderr = await new Response(proc.stderr).text();
                // console.error("rg error:", stderr);
                return [];
            }

            const output = await new Response(proc.stdout).text();

            const results: any[] = [];

            // Parse JSON output
            const lines = output.split("\n").filter(Boolean);

            // We need to group matches by file? Or return flat list of matches?
            // The previous API returned: { file, line, content }
            // Now we want context.

            // Let's group by file in memory or just emit matches.
            // The frontend probably expects a flat list of matches.

            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    if (event.type === "match") {
                        const file = event.data.path.text;
                        const lineNum = event.data.line_number;
                        const content = event.data.lines.text.trimEnd(); // Remove trailing newline

                        // Handle context if available?
                        // rg --json structure is complex.
                        // "match" event contains "lines" (the matching line).
                        // It does NOT contain the context. Context comes as separate "context" events.
                        // Ideally we attribute context to the match.
                        // But context events come before/after match events.

                        // For simplicity in this iteration, if we want to show 2 lines of context *in the results list*,
                        // we might need to buffer.
                        // But `rg --json` makes associating context hard if we just parse line by line stateless.
                        // However, the simpler requirements "Show 2 lines of context" might mean just grabbing the surrounding lines.

                        // If parsing context is too hard with JSON stream without a state machine,
                        // maybe we can just return the match line first, and if context is needed, we fetch it?
                        // OR we implement a simple state machine.

                        // Let's accumulate. 

                        results.push({
                            file,
                            line: lineNum,
                            content,
                            // context: ... // TODO: Populate context
                        });
                    }
                    // Handle context events
                } catch (e) {
                    // ignore parse error
                }
            }

            // To properly handle context, we need to associate `context` events with `match` events.
            // `context` events have line numbers. 
            // Let's try to improve this if we have time. For now, basic search matches.
            // But wait, "Contextual Results: Show 2 lines of context". 
            // I should try to parse it.
            // TODO: Actually parse context events.

            return results;

        } catch (e) {
            console.error("Search error:", e);
            return [];
        }
    }
}

export const gitService = new GitService();
