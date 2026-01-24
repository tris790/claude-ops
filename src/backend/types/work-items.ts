export interface WorkItem {
    id: number;
    rev: number;
    fields: {
        "System.Id": number;
        "System.Title": string;
        "System.WorkItemType": string;
        "System.State": string;
        "System.AssignedTo"?: {
            displayName: string;
            id: string;
            uniqueName: string;
            imageUrl?: string;
        };
        "System.Description"?: string;
        "System.CreatedDate": string;
        "System.ChangedDate": string;
        [key: string]: any;
    };
    relations?: WorkItemRelation[];
    url: string;
}

export interface WorkItemRelation {
    rel: string;
    url: string;
    attributes?: Record<string, any>;
}

export interface WorkItemQueryResult {
    queryType: string;
    queryResultType: string;
    asOf: string;
    columns: { referenceName: string; name: string; url: string }[];
    workItems: { id: number; url: string }[];
}

export interface WorkItemUpdate {
    op: "add" | "remove" | "replace" | "test";
    path: string;
    value: any;
    from?: string;
}
