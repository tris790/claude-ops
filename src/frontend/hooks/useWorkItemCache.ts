import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { getRecentWorkItems } from '../api/work-items';

// Global memory cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedItems: { data: any[], timestamp: number } | null = null;

export interface WorkItemFilterOptions {
    query: string;
    states?: string[];
    assignedToIds?: string[];
    types?: string[];
}

export function useWorkItemCache() {
    // Fetching recent items to populate the list and filters

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
            const data = await getRecentWorkItems();
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
        if (options.states && options.states.length > 0) {
            result = result.filter(item => options.states?.includes(item.fields['System.State']));
        }
        if (options.types && options.types.length > 0) {
            result = result.filter(item => options.types?.includes(item.fields['System.WorkItemType']));
        }
        if (options.assignedToIds && options.assignedToIds.length > 0) {
            result = result.filter(item => {
                const user = item.fields['System.AssignedTo'];
                const key = user ? (user.uniqueName || user.displayName) : "unassigned";
                return options.assignedToIds?.includes(key);
            });
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
