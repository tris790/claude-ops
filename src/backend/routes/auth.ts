import { azureClient } from "../services/azure";
import { updateEnv } from "../services/config";

export const authRoutes = {
    "/api/auth/status": async () => {
        const isConfigured = !!process.env.AZURE_DEVOPS_PAT && !!process.env.AZURE_DEVOPS_ORG_URL;
        return Response.json({ isAuthenticated: isConfigured });
    },

    "/api/setup": {
        async POST(req: Request) {
            try {
                const body = await req.json();
                const { orgUrl, pat } = body;

                if (!orgUrl || !pat) return Response.json({ error: "Missing fields" }, { status: 400 });

                // Validate first
                await azureClient.validateConnection(orgUrl, pat);

                // Save
                await updateEnv({
                    AZURE_DEVOPS_ORG_URL: orgUrl,
                    AZURE_DEVOPS_PAT: pat
                });

                return Response.json({ success: true });
            } catch (e: any) {
                return Response.json({ error: e.message }, { status: 401 });
            }
        }
    }
};
