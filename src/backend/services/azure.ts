export class AzureDevOpsClient {
    private get headers() {
        const pat = process.env.AZURE_DEVOPS_PAT;
        // Basic auth requires empty username and PAT as password
        const b64 = Buffer.from(`:${pat}`).toString("base64");
        return {
            "Authorization": `Basic ${b64}`,
            "Content-Type": "application/json"
        };
    }

    private get baseUrl() {
        // e.g. https://dev.azure.com/myorg
        return process.env.AZURE_DEVOPS_ORG_URL?.replace(/\/$/, "");
    }

    async validateConnection(orgUrl?: string, pat?: string) {
        // Allow passing credentials explicitly for setup/validation
        const targetUrl = (orgUrl || this.baseUrl)?.replace(/\/$/, "");
        const targetPat = pat || process.env.AZURE_DEVOPS_PAT;

        if (!targetUrl || !targetPat) {
            throw new Error("Missing configuration");
        }

        const b64 = Buffer.from(`:${targetPat}`).toString("base64");
        const headers = {
            "Authorization": `Basic ${b64}`,
            "Content-Type": "application/json"
        };

        const url = `${targetUrl}/_apis/projects?api-version=7.0`;
        try {
            const res = await fetch(url, { headers });

            if (!res.ok) {
                if (res.status === 401) throw new Error("Invalid Personal Access Token");
                if (res.status === 404) throw new Error("Organization not found");
                throw new Error(`Connection failed: ${res.status} ${res.statusText}`);
            }

            return await res.json();
        } catch (error: any) {
            throw new Error(error.message || "Failed to connect to Azure DevOps");
        }
    }
}

export const azureClient = new AzureDevOpsClient();
