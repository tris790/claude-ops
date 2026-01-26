import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { getPullRequests } from '../api/prs';

// Global memory cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache: Record<string, { data: any[], timestamp: number }> = {};

export interface PrFilterOptions {
    query: string;
    repository?: string;
    author?: string;
}

export function usePullRequestCache(status: string = 'active') {
    const [prs, setPrs] = useState<any[]>(cache[status]?.data || []);
    const [loading, setLoading] = useState(!cache[status]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const cached = cache[status];
        const isStale = cached ? Date.now() - cached.timestamp > CACHE_TTL : true;

        if (!cached || isStale) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [status]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getPullRequests(status);
            cache[status] = {
                data,
                timestamp: Date.now()
            };
            setPrs(data);
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

        // 2. Exact Filters (if any)
        if (options.repository) {
            result = result.filter(pr => pr.repository.name === options.repository);
        }
        if (options.author) {
            result = result.filter(pr => pr.createdBy.displayName === options.author);
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
