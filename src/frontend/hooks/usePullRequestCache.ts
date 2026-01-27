import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { getPullRequests } from '../api/prs';

// Global memory cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache: Record<string, { data: any[], timestamp: number }> = {};

export interface PrFilterOptions {
    query: string;
    repositoryIds?: string[];
    authorIds?: string[];
    projectNames?: string[];
}

export function usePullRequestCache(statuses: string[] = ['active']) {
    const statusKey = statuses.slice().sort().join(',');
    const [prs, setPrs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [statusKey]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const results = await Promise.all(statuses.map(async (status) => {
                const cached = cache[status];
                const isStale = cached ? Date.now() - cached.timestamp > CACHE_TTL : true;

                if (cached && !isStale) {
                    return cached.data;
                }

                const data = await getPullRequests(status);
                cache[status] = {
                    data,
                    timestamp: Date.now()
                };
                return data;
            }));

            // Flatten and remove duplicates (by pullRequestId)
            const flattened = results.flat();
            const unique = Array.from(new Map(flattened.map(item => [item.pullRequestId, item])).values());

            // Sort by creationDate descending
            unique.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());

            setPrs(unique);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fuse = useMemo(() => {
        return new Fuse(prs, {
            keys: [
                'title',
                'pullRequestId',
                'repository.name',
                'createdBy.displayName'
            ],
            threshold: 0.4,
            includeScore: true
        });
    }, [prs]);

    const filterPrs = (options: PrFilterOptions) => {
        let result = prs;

        // 1. Search (Fuzzy)
        if (options.query.trim()) {
            const fuseResults = fuse.search(options.query);
            result = fuseResults.map(r => r.item);
        }

        // 2. Exact Filters
        if (options.repositoryIds && options.repositoryIds.length > 0) {
            result = result.filter(pr => options.repositoryIds?.includes(pr.repository.id));
        }
        if (options.authorIds && options.authorIds.length > 0) {
            result = result.filter(pr => options.authorIds?.includes(pr.createdBy.uniqueName || pr.createdBy.displayName));
        }
        if (options.projectNames && options.projectNames.length > 0) {
            result = result.filter(pr => options.projectNames?.includes(pr.repository.project.name));
        }

        return result;
    };

    const refresh = () => fetchData();

    return {
        prs,
        loading,
        error,
        filterPrs,
        refresh
    };
}
