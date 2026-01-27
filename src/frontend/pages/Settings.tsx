import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useDebounce } from '../hooks/useDebounce';
import { Plus, Trash2, FolderOpen, Moon, Sun, Wand2, Check, Info } from 'lucide-react';
import type { Settings } from '../../shared/types';

const PROMPT_INFO: Record<string, { title: string; description: string }> = {
    'generate_pr_description': {
        title: 'PR Description Generation',
        description: 'Instructions for the AI when generating a Pull Request description based on git history.'
    },
    'apply_fix': {
        title: 'Code Fix Application',
        description: 'Instructions for the AI when applying a specific code fix or refactoring to a file.'
    },
    'implement_work_item': {
        title: 'Work Item Implementation',
        description: 'Instructions for the autonomous agent when implementing a full work item.'
    }
};

function PromptItem({ name, data, info, onUpdate, onRemove }: {
    name: string;
    data: Settings['aiCommandPrompts'][string];
    info?: { title: string; description: string };
    onUpdate: (oldName: string, field: 'name' | 'prompt', value: string) => void;
    onRemove: (name: string) => void;
}) {
    const [localName, setLocalName] = useState(name);

    // Keep local name in sync if it changes externally (e.g. from state update)
    useEffect(() => {
        setLocalName(name);
    }, [name]);

    return (
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg group transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                    <div className="flex items-center flex-wrap gap-2">
                        {info ? (
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    {info.title}
                                    <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 rounded font-mono uppercase shrink-0">System</span>
                                </h3>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    {info.description}
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 min-w-0">
                                <input
                                    type="text"
                                    value={localName}
                                    onChange={(e) => setLocalName(e.target.value)}
                                    onBlur={() => onUpdate(name, 'name', localName)}
                                    className="w-full bg-transparent border-none p-0 text-sm font-semibold text-zinc-900 dark:text-zinc-200 focus:ring-0 placeholder-zinc-400 dark:placeholder-zinc-600"
                                    placeholder="Prompt Name"
                                />
                            </div>
                        )}

                        {data.placeholders.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                                {data.placeholders.map(p => (
                                    <span key={p} className="px-1.5 py-0.5 bg-sapphire-500/10 border border-sapphire-500/20 rounded-md text-[9px] font-mono text-sapphire-600 dark:text-sapphire-400">
                                        {`{{${p}}}`}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <textarea
                        value={data.prompt}
                        onChange={(e) => onUpdate(name, 'prompt', e.target.value)}
                        rows={4}
                        className="w-full bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sapphire-600/50 resize-y font-mono leading-relaxed transition-all"
                        placeholder="Enter system prompt instructions..."
                    />
                </div>
                {!info && (
                    <button
                        onClick={() => onRemove(name)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title="Delete Prompt"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

export function SettingsPage() {
    const { settings, isLoading, updateSettings } = useSettings();
    const [localSettings, setLocalSettings] = useState<Settings | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Sync local state when settings initialize
    useEffect(() => {
        if (settings && !localSettings) {
            setLocalSettings(settings);
        }
    }, [settings, localSettings]);

    // Use debounced value to trigger saves
    const debouncedSettings = useDebounce(localSettings, 800);

    // Effect to auto-save when debounced settings change
    useEffect(() => {
        if (!debouncedSettings || !settings) return;

        // Prevent race condition: if local settings don't match debounced,
        // it means user is still interacting or we have a pending specific update.
        // Wait for debounce to catch up to local.
        if (localSettings !== debouncedSettings) return;

        // Check if anything actually changed to prevent loops/unnecessary hits
        const hasChanges = JSON.stringify(debouncedSettings) !== JSON.stringify(settings);
        if (hasChanges) {
            saveChanges(debouncedSettings);
        }
    }, [debouncedSettings, settings, localSettings]);

    const saveChanges = async (newSettings: Settings) => {
        setIsSaving(true);
        try {
            await updateSettings(newSettings);
        } catch (e) {
            console.error("Failed to auto-save settings", e);
        } finally {
            setIsSaving(false);
        }
    };

    // Immediate update for "toggle" type interactions (e.g. Theme)
    const handleImmediateUpdate = (updates: Partial<Settings>) => {
        if (!localSettings) return;
        const newSettings = { ...localSettings, ...updates };
        setLocalSettings(newSettings);
        // Also fire updateSettings immediately for snappiness, bypassing debounce for toggles
        // The debounce effect will essentially be a no-op since settings will match
        updateSettings(updates).catch(console.error);
    };

    // Local update for text inputs (waits for debounce)
    const handleLocalUpdate = (updates: Partial<Settings>) => {
        if (!localSettings) return;
        setLocalSettings({ ...localSettings, ...updates });
    };

    const addPrompt = () => {
        if (!localSettings) return;
        const id = crypto.randomUUID().slice(0, 8);
        const name = `custom_prompt_${id}`;
        const newPrompts = {
            ...localSettings.aiCommandPrompts,
            [name]: { prompt: '', placeholders: [] }
        };
        handleLocalUpdate({ aiCommandPrompts: newPrompts });
    };

    const removePrompt = (name: string) => {
        if (!localSettings) return;
        const newPrompts = { ...localSettings.aiCommandPrompts };
        delete newPrompts[name];
        handleLocalUpdate({ aiCommandPrompts: newPrompts });
    };

    const extractPlaceholders = (prompt: string): string[] => {
        const matches = prompt.match(/\{\{([^}]+)\}\}/g);
        if (!matches) return [];
        return Array.from(new Set(matches.map(m => m.slice(2, -2))));
    };

    const updatePrompt = (oldName: string, field: 'name' | 'prompt', value: string) => {
        if (!localSettings) return;
        const newPrompts = { ...localSettings.aiCommandPrompts };

        if (field === 'name') {
            if (oldName === value) return;
            const data = newPrompts[oldName];
            if (!data) return;
            delete newPrompts[oldName];
            newPrompts[value] = data;
        } else {
            const current = newPrompts[oldName];
            if (!current) return;
            newPrompts[oldName] = {
                ...current,
                prompt: value,
                placeholders: extractPlaceholders(value)
            };
        }

        handleLocalUpdate({ aiCommandPrompts: newPrompts });
    };

    if (isLoading || !localSettings) {
        return (
            <div className="p-8 space-y-4">
                <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
                <div className="h-64 bg-zinc-800/50 rounded animate-pulse" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8 pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        Settings
                        {isSaving && (
                            <span className="text-xs font-normal text-zinc-500 animate-pulse">Saving...</span>
                        )}
                        {!isSaving && settings && JSON.stringify(settings) === JSON.stringify(localSettings) && (
                            <span className="text-xs font-normal text-emerald-500/50 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Saved
                            </span>
                        )}
                    </h1>
                    <p className="text-zinc-400 mt-1">Manage your application preferences and defaults</p>
                </div>
            </header>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                    <Sun className="h-5 w-5 text-zinc-400" />
                    Appearance
                </h2>
                <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">Theme Mode</label>
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleImmediateUpdate({ theme: 'dark' })}
                                className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${localSettings.theme === 'dark'
                                    ? 'border-sapphire-500 bg-sapphire-500/5 text-sapphire-600 dark:text-zinc-100'
                                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                                    }`}
                            >
                                <Moon className="h-6 w-6" />
                                <span className="font-medium">Dark Mode</span>
                            </button>
                            <button
                                onClick={() => handleImmediateUpdate({ theme: 'light' })}
                                className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${localSettings.theme === 'light'
                                    ? 'border-sapphire-500 bg-sapphire-500/5 text-sapphire-600 dark:text-zinc-100'
                                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                                    }`}
                            >
                                <Sun className="h-6 w-6" />
                                <span className="font-medium">Light Mode</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-zinc-400" />
                    Storage
                </h2>
                <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Repository Clone Directory</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={localSettings.repoCloneDirectory}
                            onChange={(e) => handleLocalUpdate({ repoCloneDirectory: e.target.value })}
                            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sapphire-600/50 transition-all font-mono text-sm"
                            placeholder="/path/to/repos"
                        />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                        Repositories will be cloned to this directory. Changing this will not move existing repositories.
                    </p>
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-zinc-400" />
                        AI Command Prompts
                    </h2>
                    <button
                        onClick={addPrompt}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sapphire-400 hover:text-sapphire-300 hover:bg-sapphire-500/10 rounded-md transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Prompt
                    </button>
                </div>

                <div className="space-y-4">
                    {Object.entries(localSettings.aiCommandPrompts).length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg border-dashed">
                            <p className="text-zinc-500 text-sm">No custom prompts defined.</p>
                        </div>
                    ) : (
                        Object.entries(localSettings.aiCommandPrompts)
                            .sort(([nameA], [nameB]) => {
                                const isSystemA = nameA in PROMPT_INFO;
                                const isSystemB = nameB in PROMPT_INFO;
                                if (isSystemA && !isSystemB) return -1;
                                if (!isSystemA && isSystemB) return 1;
                                return nameA.localeCompare(nameB);
                            })
                            .map(([name, data]) => (
                                <PromptItem
                                    key={name}
                                    name={name}
                                    data={data}
                                    info={PROMPT_INFO[name]}
                                    onUpdate={updatePrompt}
                                    onRemove={removePrompt}
                                />
                            ))
                    )}
                </div>
            </section>
        </div>
    );
}

