import { useState, useEffect } from 'react';
import type { Settings } from '../../shared/types';

export function useSettings() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error('Failed to fetch settings');
            const data = await res.json();
            setSettings(data);
            applyTheme(data.theme);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    const updateSettings = async (updates: Partial<Settings>) => {
        // Optimistic update
        if (updates.theme) {
            applyTheme(updates.theme);
        }
        setSettings(prev => prev ? { ...prev, ...updates } : prev);

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error('Failed to update settings');
            const newSettings = await res.json();
            setSettings(newSettings);
            applyTheme(newSettings.theme);
            return newSettings;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            throw err;
        }
    };

    const applyTheme = (theme: 'dark' | 'light') => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
        } else {
            root.classList.remove('dark');
            root.style.colorScheme = 'light';
        }
    };

    return {
        settings,
        isLoading,
        error,
        updateSettings,
        refresh: fetchSettings
    };
}
