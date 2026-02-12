import { gitService } from "../services/git";
import { lspInstallerService } from "../services/lsp-installer";
import { inspectLspAvailability, normalizeLspLanguage } from "../services/lsp-tools";

const getJobId = (req: Request) => {
    try {
        const url = new URL(req.url);
        const match = url.pathname.match(/\/api\/lsp\/install\/([^/]+)$/);
        return match?.[1] || "";
    } catch {
        return "";
    }
};

export const lspRoutes = {
    "/api/lsp/status": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const projectName = url.searchParams.get("project");
            const repoName = url.searchParams.get("repo");
            const language = url.searchParams.get("language");

            if (!projectName || !repoName || !language) {
                return Response.json({ error: "Missing required query params: project, repo, language" }, { status: 400 });
            }

            const normalizedLanguage = normalizeLspLanguage(language);
            const capability = normalizedLanguage
                ? lspInstallerService.getInstallCapability(normalizedLanguage)
                : { canInstall: false, reason: `Language ${language} is not supported` };

            const isCloned = await gitService.isCloned(projectName, repoName);
            if (!isCloned) {
                return Response.json({
                    requestedLanguage: language,
                    normalizedLanguage,
                    supported: Boolean(normalizedLanguage),
                    installed: false,
                    resolverTier: null,
                    command: null,
                    canInstall: capability.canInstall,
                    missingReason: "Repository is not cloned locally",
                });
            }

            const rootPath = await gitService.getRepoPath(projectName, repoName);
            const availability = await inspectLspAvailability(rootPath, language);

            return Response.json({
                ...availability,
                canInstall: capability.canInstall,
                installUnavailableReason: capability.reason,
            });
        },
    },

    "/api/lsp/install": {
        async POST(req: Request) {
            try {
                const body = await req.json() as {
                    projectName?: string;
                    repoName?: string;
                    languages?: string[];
                };
                const projectName = body.projectName;
                const repoName = body.repoName;
                const languages = Array.isArray(body.languages) ? body.languages : [];

                if (!projectName || !repoName || !languages.length) {
                    return Response.json({ error: "Missing required fields: projectName, repoName, languages[]" }, { status: 400 });
                }

                const isCloned = await gitService.isCloned(projectName, repoName);
                if (!isCloned) {
                    return Response.json({ error: "Repository is not cloned locally" }, { status: 400 });
                }

                const rootPath = await gitService.getRepoPath(projectName, repoName);
                const normalizedUnique = Array.from(new Set(
                    languages
                        .map((language) => normalizeLspLanguage(language))
                        .filter((language): language is NonNullable<typeof language> => Boolean(language)),
                ));

                if (!normalizedUnique.length) {
                    return Response.json({ error: "No supported languages were provided" }, { status: 400 });
                }

                const missing: string[] = [];
                const installabilityErrors: string[] = [];

                for (const language of normalizedUnique) {
                    const availability = await inspectLspAvailability(rootPath, language);
                    if (availability.installed) continue;

                    const capability = lspInstallerService.getInstallCapability(language);
                    if (!capability.canInstall) {
                        installabilityErrors.push(`${language}: ${capability.reason || "automatic installation is unavailable"}`);
                        continue;
                    }
                    missing.push(language);
                }

                if (installabilityErrors.length) {
                    return Response.json({
                        error: "Some language servers cannot be installed automatically",
                        details: installabilityErrors,
                    }, { status: 400 });
                }

                const job = lspInstallerService.startInstall({
                    projectName,
                    repoName,
                    rootPath,
                    languages: missing,
                });

                return Response.json({
                    jobId: job.id,
                    status: job.status,
                    queuedLanguages: missing,
                });
            } catch (error) {
                return Response.json({ error: "Invalid JSON body", details: error instanceof Error ? error.message : String(error) }, { status: 400 });
            }
        },
    },

    "/api/lsp/install/:jobId": {
        async GET(req: Request) {
            const jobId = getJobId(req);
            if (!jobId) {
                return Response.json({ error: "Invalid job id" }, { status: 400 });
            }

            const job = lspInstallerService.getJob(jobId);
            if (!job) {
                return Response.json({ error: "Install job not found" }, { status: 404 });
            }

            return Response.json(job);
        },
    },
};
