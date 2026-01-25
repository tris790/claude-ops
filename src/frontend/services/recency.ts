
const KEY = 'claude-ops-recency';
const MAX_ITEMS = 100;

export interface RecentItem {
    id: string; // Unique ID (e.g., "repo:foo/bar", "pr:123", "cmd:settings")
    type: 'repo' | 'pr' | 'workitem' | 'file' | 'command';
    label: string;
    path: string; // Navigation path
    lastAccessed: number;
    hits: number;
    meta?: Record<string, any>;
}

export const RecencyService = {
    getAll: (): RecentItem[] => {
        try {
            // Check if window is defined (SSR safety, though mostly client-side)
            if (typeof window === 'undefined') return [];
            const raw = localStorage.getItem(KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("Failed to load recency data", e);
            return [];
        }
    },

    track: (item: Omit<RecentItem, 'lastAccessed' | 'hits'>) => {
        if (typeof window === 'undefined') return;

        try {
            const items = RecencyService.getAll();
            const existingIndex = items.findIndex(i => i.id === item.id);

            if (existingIndex >= 0) {
                // Move to top and update
                const existing = items[existingIndex];
                if (existing) {
                    items.splice(existingIndex, 1);
                    items.unshift({
                        ...existing,
                        label: item.label, // Update label if it changed
                        path: item.path,
                        lastAccessed: Date.now(),
                        hits: existing.hits + 1
                    });
                }
            } else {
                items.unshift({
                    ...item,
                    lastAccessed: Date.now(),
                    hits: 1
                });
            }

            // Trim
            if (items.length > MAX_ITEMS) {
                items.length = MAX_ITEMS;
            }

            localStorage.setItem(KEY, JSON.stringify(items));
        } catch (e) {
            console.error("Failed to save recency data", e);
        }
    },

    getScoreBoost: (id: string): number => {
        const items = RecencyService.getAll();
        const item = items.find(i => i.id === id);
        if (!item) return 0;

        let boost = 0;

        // Frequency boost (capped)
        // 1 hit = 0 boost (needs to be revisited to count)
        // 2 hits = 5
        // 10 hits = 45
        boost += Math.min(item.hits * 5, 50);

        // Recency boost
        const now = Date.now();
        const msSince = now - item.lastAccessed;
        const hoursSince = msSince / (1000 * 60 * 60);

        if (hoursSince < 1) boost += 50;       // Very recent
        else if (hoursSince < 24) boost += 30; // Last day
        else if (hoursSince < 72) boost += 10; // Last 3 days
        else if (hoursSince < 168) boost += 5; // Last week

        return boost;
    }
};
