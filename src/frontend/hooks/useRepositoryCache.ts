import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { getRepositories, type GitRepository } from '../api/repos';
import { RecencyService } from '../services/recency';

// Global memory cache to prevent re-fetching on navigation
let cachedRepos: GitRepository[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface RepoFilterOptions {
    query: string;
    projects: string[]; // Selected project IDs or Names
}

export function useRepositoryCache() {
    const [repos, setRepos] = useState<GitRepository[]>(cachedRepos || []);
    const [loading, setLoading] = useState(!cachedRepos);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const isStale = Date.now() - cacheTimestamp > CACHE_TTL;
        if (!cachedRepos || isStale) {
            setLoading(true);
            getRepositories()
                .then((data) => {
                    cachedRepos = data;
                    cacheTimestamp = Date.now();
                    setRepos(data);
                    setError(null);
                })
                .catch((err) => {
                    setError(err.message);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    const projects = useMemo(() => {
        const unique = new Set(repos.map(r => r.project.name));
        return Array.from(unique).sort();
    }, [repos]);

    const fuse = useMemo(() => {
        return new Fuse(repos, {
            keys: ['name', 'project.name'],
            threshold: 0.4,
            includeScore: true
        });
    }, [repos]);

    const filterRepos = (options: RepoFilterOptions) => {
        let result = repos;

        // 1. Filter by Project
        if (options.projects.length > 0) {
            result = result.filter(r => options.projects.includes(r.project.name));
        }

        // 2. Filter by Query (Fuzzy)
        let scoredResults: { item: GitRepository, score?: number }[] = [];

        if (options.query.trim()) {
            const fuseResults = fuse.search(options.query);
            scoredResults = fuseResults.map(r => ({ item: r.item, score: r.score }));
        } else {
            scoredResults = result.map(item => ({ item }));
        }

        // 3. Sort
        // Priority: 
        // - Exact match (score close to 0) -> Handled by Fuse rank usually, but we want structured sort
        // - Cloned (Top)
        // - Recent (High)
        // - Alphabetical (Bottom)

        return scoredResults.sort((a, b) => {
            // 1. Cloned First
            if (a.item.isCloned !== b.item.isCloned) {
                return a.item.isCloned ? -1 : 1;
            }

            // 2. Recency
            // We calculate a boost for recency.
            // RecencyService keys: "repo:<id>" or we need to align ID. 
            // The RecencyService.track uses `item.id`. RepoList currently navigates to project/repo.
            // Let's assume we track using `repo.id` (GUID) for robustness.

            const boostA = RecencyService.getScoreBoost(`repo:${a.item.id}`);
            const boostB = RecencyService.getScoreBoost(`repo:${b.item.id}`);

            if (boostA !== boostB) {
                return boostB - boostA; // Higher boost first
            }

            // 3. Search Score (if searching)
            if (options.query.trim()) {
                const scoreA = a.score ?? 1;
                const scoreB = b.score ?? 1;
                if (scoreA !== scoreB) return scoreA - scoreB; // Lower score is better in Fuse
            }

            // 4. Alphabetical
            return a.item.name.localeCompare(b.item.name);
        }).map(r => r.item);
    };

    // Force refresh
    const refresh = async () => {
        setLoading(true);
        try {
            const data = await getRepositories();
            cachedRepos = data;
            cacheTimestamp = Date.now();
            setRepos(data);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        repos,
        projects,
        loading,
        error,
        filterRepos,
        refresh
    };
}
