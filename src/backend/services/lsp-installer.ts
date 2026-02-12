import type { NormalizedLspLanguage } from "./lsp-tools";
import { inspectLspAvailability, normalizeLspLanguage } from "./lsp-tools";

type InstallStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
type InstallJobStatus = "pending" | "running" | "completed" | "failed";

export interface LspInstallStep {
    language: NormalizedLspLanguage;
    status: InstallStepStatus;
    message: string;
    command: string | null;
    output: string[];
    startedAt: number | null;
    completedAt: number | null;
}

export interface LspInstallJob {
    id: string;
    projectName: string;
    repoName: string;
    rootPath: string;
    status: InstallJobStatus;
    error: string | null;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    steps: LspInstallStep[];
}

export interface LspInstallCapability {
    canInstall: boolean;
    reason: string | null;
}

const COMMAND_TIMEOUT_MS = 20 * 60 * 1000;

const isRootUser = () => {
    if (typeof process.getuid !== "function") return false;
    return process.getuid() === 0;
};

const commandExists = (cmd: string) => Boolean(Bun.which(cmd));

const withSudoIfNeeded = (command: string[]) => {
    if (process.platform !== "linux") return command;
    if (isRootUser()) return command;
    if (!commandExists("sudo")) return command;
    return ["sudo", "-n", ...command];
};

const commandToString = (command: string[]) => command.map((part) => {
    if (!part.includes(" ")) return part;
    return `"${part.replaceAll("\"", "\\\"")}"`;
}).join(" ");

export class LspInstallerService {
    private jobs = new Map<string, LspInstallJob>();

    public getInstallCapability(language: string): LspInstallCapability {
        const normalized = normalizeLspLanguage(language);
        if (!normalized) {
            return { canInstall: false, reason: `Language ${language} is not supported` };
        }

        if (normalized === "typescript" || normalized === "javascript") {
            if (commandExists("npm") || commandExists("bun")) return { canInstall: true, reason: null };
            return { canInstall: false, reason: "npm or bun is required to install TypeScript language server" };
        }

        if (normalized === "go") {
            if (commandExists("go")) return { canInstall: true, reason: null };
            return { canInstall: false, reason: "go toolchain is required to install gopls" };
        }

        if (normalized === "csharp") {
            if (commandExists("dotnet")) return { canInstall: true, reason: null };
            return { canInstall: false, reason: "dotnet SDK is required to install csharp-ls" };
        }

        if (normalized === "c" || normalized === "cpp") {
            if (process.platform === "darwin" && commandExists("brew")) return { canInstall: true, reason: null };
            if (process.platform === "linux") {
                const packageManagers = ["apt-get", "dnf", "yum", "pacman", "zypper"];
                if (packageManagers.some((manager) => commandExists(manager))) {
                    return { canInstall: true, reason: null };
                }
                return { canInstall: false, reason: "No supported Linux package manager found for clangd installation" };
            }
            if (process.platform === "win32" && (commandExists("winget") || commandExists("choco"))) {
                return { canInstall: true, reason: null };
            }
            return { canInstall: false, reason: "No supported package manager found for clangd installation" };
        }

        return { canInstall: false, reason: `Automatic install is not implemented for ${normalized}` };
    }

    public startInstall(options: {
        projectName: string;
        repoName: string;
        rootPath: string;
        languages: string[];
    }): LspInstallJob {
        const uniqueLanguages = Array.from(new Set(
            options.languages
                .map((language) => normalizeLspLanguage(language))
                .filter((language): language is NormalizedLspLanguage => Boolean(language)),
        ));

        const steps: LspInstallStep[] = uniqueLanguages.map((language) => ({
            language,
            status: "pending",
            message: "Queued",
            command: null,
            output: [],
            startedAt: null,
            completedAt: null,
        }));

        const job: LspInstallJob = {
            id: crypto.randomUUID(),
            projectName: options.projectName,
            repoName: options.repoName,
            rootPath: options.rootPath,
            status: "pending",
            error: null,
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            steps,
        };

        this.jobs.set(job.id, job);
        void this.runJob(job.id);

        return this.cloneJob(job);
    }

    public getJob(jobId: string): LspInstallJob | null {
        const job = this.jobs.get(jobId);
        return job ? this.cloneJob(job) : null;
    }

    private cloneJob(job: LspInstallJob): LspInstallJob {
        return {
            ...job,
            steps: job.steps.map((step) => ({
                ...step,
                output: [...step.output],
            })),
        };
    }

    private appendOutput(step: LspInstallStep, line: string) {
        step.output.push(line);
        if (step.output.length > 200) {
            step.output.splice(0, step.output.length - 200);
        }
    }

    private async runJob(jobId: string) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = "running";
        job.startedAt = Date.now();

        for (const step of job.steps) {
            const availability = await inspectLspAvailability(job.rootPath, step.language);
            if (availability.installed) {
                step.status = "skipped";
                step.message = "Already installed";
                step.completedAt = Date.now();
                continue;
            }

            const capability = this.getInstallCapability(step.language);
            if (!capability.canInstall) {
                step.status = "failed";
                step.message = capability.reason || "Automatic installation is unavailable";
                step.completedAt = Date.now();
                job.status = "failed";
                job.error = step.message;
                break;
            }

            step.status = "running";
            step.message = "Installing";
            step.startedAt = Date.now();

            try {
                await this.installLanguage(step);
                const postCheck = await inspectLspAvailability(job.rootPath, step.language);
                if (!postCheck.installed) {
                    throw new Error(postCheck.missingReason || "LSP server still unavailable after install");
                }

                step.status = "completed";
                step.message = "Installed";
                step.completedAt = Date.now();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                step.status = "failed";
                step.message = message;
                step.completedAt = Date.now();
                job.status = "failed";
                job.error = message;
                break;
            }
        }

        if (job.status !== "failed") {
            job.status = "completed";
        }
        job.completedAt = Date.now();
    }

    private async installLanguage(step: LspInstallStep) {
        if (step.language === "typescript" || step.language === "javascript") {
            const command = commandExists("npm")
                ? ["npm", "install", "-g", "typescript", "typescript-language-server"]
                : ["bun", "add", "-g", "typescript", "typescript-language-server"];
            await this.runCommand(command, step);
            return;
        }

        if (step.language === "go") {
            await this.runCommand(["go", "install", "golang.org/x/tools/gopls@latest"], step);
            return;
        }

        if (step.language === "csharp") {
            try {
                await this.runCommand(["dotnet", "tool", "update", "-g", "csharp-ls"], step);
            } catch (error) {
                this.appendOutput(step, `dotnet update failed, falling back to install: ${error instanceof Error ? error.message : String(error)}`);
                await this.runCommand(["dotnet", "tool", "install", "-g", "csharp-ls"], step);
            }
            return;
        }

        if (step.language === "c" || step.language === "cpp") {
            await this.installClangd(step);
            return;
        }

        throw new Error(`Automatic install is not implemented for ${step.language}`);
    }

    private async installClangd(step: LspInstallStep) {
        if (process.platform === "darwin") {
            await this.runCommand(["brew", "install", "llvm"], step);
            return;
        }

        if (process.platform === "linux") {
            if (commandExists("apt-get")) {
                await this.runCommand(withSudoIfNeeded(["apt-get", "update"]), step);
                await this.runCommand(withSudoIfNeeded(["apt-get", "install", "-y", "clangd"]), step);
                return;
            }
            if (commandExists("dnf")) {
                await this.runCommand(withSudoIfNeeded(["dnf", "install", "-y", "clang-tools-extra"]), step);
                return;
            }
            if (commandExists("yum")) {
                await this.runCommand(withSudoIfNeeded(["yum", "install", "-y", "clang-tools-extra"]), step);
                return;
            }
            if (commandExists("pacman")) {
                await this.runCommand(withSudoIfNeeded(["pacman", "-Sy", "--noconfirm", "clang"]), step);
                return;
            }
            if (commandExists("zypper")) {
                await this.runCommand(withSudoIfNeeded(["zypper", "--non-interactive", "install", "clang-tools"]), step);
                return;
            }
            throw new Error("No supported Linux package manager found for clangd installation");
        }

        if (process.platform === "win32") {
            if (commandExists("winget")) {
                await this.runCommand([
                    "winget",
                    "install",
                    "--id",
                    "LLVM.LLVM",
                    "-e",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                    "--silent",
                ], step);
                return;
            }
            if (commandExists("choco")) {
                await this.runCommand(["choco", "install", "llvm", "-y"], step);
                return;
            }
            throw new Error("winget or choco is required on Windows to install clangd");
        }

        throw new Error(`Unsupported platform for clangd installation: ${process.platform}/${process.arch}`);
    }

    private async runCommand(command: string[], step: LspInstallStep) {
        step.command = commandToString(command);
        this.appendOutput(step, `$ ${step.command}`);

        const proc = Bun.spawn(command, {
            stdout: "pipe",
            stderr: "pipe",
            env: {
                ...process.env,
                DEBIAN_FRONTEND: "noninteractive",
                HOMEBREW_NO_AUTO_UPDATE: "1",
            },
        });

        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            try {
                proc.kill();
            } catch {
            }
        }, COMMAND_TIMEOUT_MS);

        const stdoutPromise = proc.stdout ? new Response(proc.stdout).text() : Promise.resolve("");
        const stderrPromise = proc.stderr ? new Response(proc.stderr).text() : Promise.resolve("");
        const [exitCode, stdout, stderr] = await Promise.all([proc.exited, stdoutPromise, stderrPromise]);
        clearTimeout(timeout);

        if (stdout.trim()) this.appendOutput(step, stdout.trim());
        if (stderr.trim()) this.appendOutput(step, stderr.trim());

        if (timedOut) {
            throw new Error(`Command timed out: ${step.command}`);
        }
        if (exitCode !== 0) {
            throw new Error(stderr.trim() || stdout.trim() || `Command failed (${exitCode}): ${step.command}`);
        }
    }
}

export const lspInstallerService = new LspInstallerService();
