import { azureClient } from "./azure";
import type { WorkItem, WorkItemQueryResult } from "../types/work-items";

export class WorkItemService {
    async getWorkItemsByWiql(wiql: string): Promise<WorkItem[]> {
        const queryResult: WorkItemQueryResult = await azureClient.queryWorkItems(wiql);
        const ids = queryResult.workItems.map(wi => wi.id);

        if (ids.length === 0) return [];

        // Azure DevOps allows up to 200 IDs in a single request for work items details
        return await azureClient.getWorkItems(ids.slice(0, 200));
    }

    async getMyWorkItems(): Promise<WorkItem[]> {
        const wiql = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.State] <> 'Closed' ORDER BY [System.ChangedDate] DESC`;
        return this.getWorkItemsByWiql(wiql);
    }

    async getWorkItemDetails(id: number): Promise<WorkItem> {
        const items = await azureClient.getWorkItems([id]);
        if (items.length === 0) throw new Error(`Work item ${id} not found`);
        return items[0];
    }

    async updateWorkItem(id: number, fields: Record<string, any>): Promise<WorkItem> {
        const patch = Object.entries(fields).map(([key, value]) => ({
            op: "add",
            path: `/fields/${key}`,
            value
        }));
        return await azureClient.updateWorkItem(id, patch);
    }

    async addComment(id: number, text: string): Promise<any> {
        return await azureClient.addWorkItemComment(id, text);
    }
}

export const workItemService = new WorkItemService();
