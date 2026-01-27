import { getSettings, updateSettings } from "../services/settings";

export const settingsRoutes = {
    "/api/settings": {
        async GET(req: Request) {
            const settings = await getSettings();
            return Response.json(settings);
        },
        async POST(req: Request) {
            try {
                const updates = await req.json();
                const newSettings = await updateSettings(updates);
                return Response.json(newSettings);
            } catch (e) {
                return new Response("Invalid JSON", { status: 400 });
            }
        }
    }
};
