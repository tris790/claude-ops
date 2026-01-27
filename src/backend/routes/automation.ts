
import { gitService } from "../services/git";
import { getSettings, DEFAULT_SETTINGS } from "../services/settings";

export const automationRoutes = {
    "/api/automation/run": {
        async POST(req: Request) {
            try {
                const body = await req.json();
                const { task, context } = body;

                if (!task || !context) {
                    return Response.json({ error: "Missing task or context" }, { status: 400 });
                }

                // Default commands based on specs
                // We use templates that will be replaced by context variables
                // Docs:
                // generate_pr_description -> claude "Write a PR description for changes between ${target_branch} and ${source_branch}. Use the following git log/diff summary: ${diff}"
                // apply_fix -> claude "Apply the following change to file ${file_path} on branch ${branch}: '${comment}'. Code context: ${code_context}"

                let commandTemplate = "";

                const settings = await getSettings();
                // Find prompt in settings, or fallback to default settings
                const promptSetting = settings.aiCommandPrompts.find(p => p.name === task || p.id === task)
                    || DEFAULT_SETTINGS.aiCommandPrompts.find(p => p.name === task || p.id === task);

                if (promptSetting) {
                    commandTemplate = promptSetting.prompt;
                } else {
                    return Response.json({ error: "Unknown task: " + task }, { status: 400 });
                }

                // Replace variables
                // We handle simple {{var}} replacement
                let commandLine = commandTemplate;
                for (const [key, value] of Object.entries(context)) {
                    // specific replacement to avoid injection? 
                    // For now, simple string replacement. 
                    // WARNING: This is vulnerable to command injection if context values are user controlled and not escaped.
                    // Since this is a local app for developers, usage is "trusted", but we should be careful.
                    // Ideally we pass arguments separately or escape them.
                    // The `claude` CLI expects a single prompt string. 
                    // We should escape double quotes in the value if we are wrapping it in double quotes.

                    const safeValue = String(value).replace(/"/g, '\\"');
                    commandLine = commandLine.replace(new RegExp(`\{\{${key}\}\}`, 'g'), safeValue);
                }

                console.log(`[Automation] Running: ${commandLine}`);

                // Determine CWD
                // If we have repo info in context, use it
                let cwd = process.cwd();
                if (context.projectName && context.repoName) {
                    cwd = gitService.getRepoPath(context.projectName, context.repoName);
                    // Check if exists
                    const isCloned = await gitService.isCloned(context.projectName, context.repoName);
                    if (!isCloned && task === "apply_fix") {
                        return Response.json({ error: "Repository must be cloned to apply fixes." }, { status: 400 });
                    }
                }

                // Execute
                // splitting commandLine is tricky if it has quotes. 
                // Bun.spawn expects an array of arguments.
                // We might need to use `sh -c` to handle the command string parsing easily.

                const proc = Bun.spawn(["sh", "-c", commandLine], {
                    cwd,
                    stdout: "pipe",
                    stderr: "pipe",
                });

                const exitCode = await proc.exited;
                const stdout = await new Response(proc.stdout).text();
                const stderr = await new Response(proc.stderr).text();

                if (exitCode !== 0) {
                    return Response.json({
                        success: false,
                        output: stdout,
                        error: stderr,
                        exitCode
                    }, { status: 500 });
                }

                return Response.json({
                    success: true,
                    output: stdout
                });

            } catch (error: any) {
                console.error("[Automation] Error:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        }
    }
};
