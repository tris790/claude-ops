import React, { createContext, useContext } from 'react';
import { useSettings } from '../hooks/useSettings';

const ThemeContext = createContext<{
    theme: 'dark' | 'light';
    toggleTheme: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { settings, updateSettings } = useSettings();

    const toggleTheme = () => {
        if (!settings) return;
        const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
        updateSettings({ theme: newTheme });
    };

    // useSettings Hook handles the side effect of applying the theme to the DOM
    // whenever settings changes or loads.

    return (
        <ThemeContext.Provider value={{
            theme: settings?.theme || 'dark',
            toggleTheme
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    // If context is null, you could throw or return a default
    // For safety with existing pages that might not rely on provider yet:
    if (!context) {
        // Fallback or safe dummy
        return { theme: 'dark', toggleTheme: () => { } };
    }
    return context;
}
