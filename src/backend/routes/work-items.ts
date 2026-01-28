import { workItemService } from "../services/work-items";

export const workItemRoutes = {
    "/api/work-items": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const query = url.searchParams.get("query");
            const filter = url.searchParams.get("filter");

            try {
                if (filter === "my") {
                    const items = await workItemService.getMyWorkItems();
                    return Response.json(items);
                }

                if (filter === "recent") {
                    const items = await workItemService.getRecentWorkItems();
                    return Response.json(items);
                }

                if (query) {
                    const items = await workItemService.getWorkItemsByWiql(query);
                    return Response.json(items);
                }

                return Response.json({ error: "Missing query or filter" }, { status: 400 });
            } catch (error: any) {
                console.error("Error fetching work items:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/work-items/details": {
        async GET(req: Request) {
            const url = new URL(req.url);
            const id = url.searchParams.get("id");

            if (!id) {
                return Response.json({ error: "Missing work item id" }, { status: 400 });
            }

            try {
                const item = await workItemService.getWorkItemDetails(parseInt(id));
                return Response.json(item);
            } catch (error: any) {
                console.error("Error fetching work item details:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
        async PATCH(req: Request) {
            const url = new URL(req.url);
            const id = url.searchParams.get("id");

            if (!id) {
                return Response.json({ error: "Missing work item id" }, { status: 400 });
            }

            try {
                const fields = await req.json();
                const item = await workItemService.updateWorkItem(parseInt(id), fields);
                return Response.json(item);
            } catch (error: any) {
                console.error("Error updating work item:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
    "/api/work-items/comments": {
        async POST(req: Request) {
            const url = new URL(req.url);
            const id = url.searchParams.get("id");

            if (!id) {
                return Response.json({ error: "Missing work item id" }, { status: 400 });
            }

            try {
                const { text } = await req.json();
                const comment = await workItemService.addComment(parseInt(id), text);
                return Response.json(comment);
            } catch (error: any) {
                console.error("Error adding comment:", error);
                return Response.json({ error: error.message }, { status: 500 });
            }
        },
    },
};
