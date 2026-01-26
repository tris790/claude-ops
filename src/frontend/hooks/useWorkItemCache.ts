import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { getMyWorkItems } from '../api/work-items';

// Global memory cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedItems: { data: any[], timestamp: number } | null = null;

export interface WorkItemFilterOptions {
    query: string;
    state?: string;
    assignedTo?: string;
}

export function useWorkItemCache() {
    // Currently only supporting "my" work items as that's what the API supports roughly

    const [items, setItems] = useState<any[]>(cachedItems?.data || []);
    const [loading, setLoading] = useState(!cachedItems);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const isStale = cachedItems ? Date.now() - cachedItems.timestamp > CACHE_TTL : true;

        if (!cachedItems || isStale) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getMyWorkItems();
            cachedItems = {
                data,
                timestamp: Date.now()
            };
            setItems(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fuse = useMemo(() => {
        return new Fuse(items, {
            keys: [
                'id',
                'fields.System.Title',
                'fields.System.State',
                'fields.System.WorkItemType'
            ],
            threshold: 0.4,
            includeScore: true
        });
    }, [items]);

    const filterItems = (options: WorkItemFilterOptions) => {
        let result = items;

        // 1. Search (Fuzzy)
        if (options.query.trim()) {
            const fuseResults = fuse.search(options.query);
            result = fuseResults.map(r => r.item);
        }

        // 2. Exact Filters
        if (options.state) {
            result = result.filter(item => item.fields['System.State'] === options.state);
        }

        return result;
    };

    const refresh = () => fetchData();

    return {
        items,
        loading,
        error,
        filterItems,
        refresh
    };
}
