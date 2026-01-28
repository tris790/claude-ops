import { join } from "path";
import { getSettings } from "./settings";
import { gitService } from "./git";

export interface SearchResult {
    type: "match" | "context";
    file: string;
    line: number;
    content: string;
    repo: string;
    project: string;
}

export interface SearchOptions {
    query: string;
    isRegex?: boolean;
    useCaseSensitive?: boolean;
}

class SearchService {

    private parseQuery(rawQuery: string): {
        query: string,
        globs: string[],
        extensions: string[],
        isRegex: boolean
    } {
        // Handle multiple spaces and trim
        const parts = rawQuery.trim().split(/\s+/);
        const globs: string[] = [];
        const extensions: string[] = [];
        const queryParts: string[] = [];
        let isRegex = false;

        for (const part of parts) {
            if (part.startsWith("ext:")) {
                const ext = part.substring(4);
                // Handle comma separated extensions if user tries ext:ts,tsx?
                // For now, assume simple "ext:ts"
                if (ext) extensions.push(ext);
            } else if (part.startsWith("file:")) {
                const pat = part.substring(5);
                if (pat) globs.push(pat);
            } else if (part === "regex") { // flag to enable regex mode
                isRegex = true;
            } else {
                queryParts.push(part);
            }
        }

        const parsed = {
            query: queryParts.join(" "),
            globs,
            extensions,
            isRegex
        };

        console.log(`[Search] Parsed '${rawQuery}' ->`, JSON.stringify(parsed));
        return parsed;
    }

    async *searchGlobalStream(rawQuery: string): AsyncGenerator<SearchResult> {
        const settings = await getSettings();
        const baseDir = settings.repoCloneDirectory;

        try {
            await gitService.ensureBaseDir();
        } catch (e) {
            return;
        }

        const { query, globs, extensions, isRegex } = this.parseQuery(rawQuery);

        if (!query.trim()) {
            return;
        }

        const args = ["rg", "--json"];

        args.push(isRegex ? "--pcre2" : "--fixed-strings");
        if (!isRegex) {
            args.push("--smart-case");
        } else {
            args.push("--smart-case");
        }

        // Logic: (file:A OR file:B) AND (ext:1 OR ext:2)
        const finalGlobs: string[] = [];
        if (globs.length > 0 && extensions.length > 0) {
            for (const g of globs) {
                for (const ext of extensions) {
                    const safeExt = ext.startsWith(".") ? ext.substring(1) : ext;
                    finalGlobs.push(`*${g}*.${safeExt}`);
                }
            }
        } else if (globs.length > 0) {
            for (const g of globs) {
                finalGlobs.push(`*${g}*`);
            }
        } else if (extensions.length > 0) {
            for (const ext of extensions) {
                const safeExt = ext.startsWith(".") ? ext.substring(1) : ext;
                finalGlobs.push(`*.${safeExt}`);
            }
        }

        for (const g of finalGlobs) {
            args.push("--glob", g);
        }

        args.push("-e", query);
        args.push("--max-columns", "200");

        console.log(`[Search] Spawning rg with args:`, args.join(" "));

        try {
            const proc = Bun.spawn(args, {
                cwd: baseDir,
                stdout: "pipe",
                stderr: "pipe"
            });

            const reader = proc.stdout.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // Keep the last chunk as it might be incomplete
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        if (event.type === "match") {
                            const pathText = event.data.path.text;
                            const pathParts = pathText.split("/");
                            let project = "";
                            let repo = "";
                            let filePath = pathText;

                            if (pathParts.length >= 2) {
                                project = pathParts[0];
                                repo = pathParts[1];
                                filePath = pathParts.slice(2).join("/");
                            }

                            yield {
                                type: "match",
                                file: filePath,
                                repo: repo,
                                project: project,
                                line: event.data.line_number,
                                content: event.data.lines.text.trimEnd()
                            };
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }

            // Process remaining buffer
            if (buffer.trim()) {
                try {
                    const event = JSON.parse(buffer);
                    if (event.type === "match") {
                        const pathText = event.data.path.text;
                        const pathParts = pathText.split("/");
                        let project = "";
                        let repo = "";
                        let filePath = pathText;

                        if (pathParts.length >= 2) {
                            project = pathParts[0];
                            repo = pathParts[1];
                            filePath = pathParts.slice(2).join("/");
                        }

                        yield {
                            type: "match",
                            file: filePath,
                            repo: repo,
                            project: project,
                            line: event.data.line_number,
                            content: event.data.lines.text.trimEnd()
                        };
                    }
                } catch (e) { }
            }

        } catch (e) {
            console.error("Global search failed:", e);
        }
    }
}

export const searchService = new SearchService();
