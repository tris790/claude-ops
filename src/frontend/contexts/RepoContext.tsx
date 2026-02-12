import React, { createContext, useContext, useState, useCallback } from "react";

export interface RepoContextState {
    project: string | null;
    repo: string | null;
    branch: string | null;
    file: string | null;
    language: string | null;
}

interface RepoContextValue extends RepoContextState {
    setContext: (ctx: Partial<RepoContextState>) => void;
    clearContext: () => void;
}

const defaultState: RepoContextState = {
    project: null,
    repo: null,
    branch: null,
    file: null,
    language: null,
};

const RepoContext = createContext<RepoContextValue | null>(null);

export function RepoProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<RepoContextState>(defaultState);

    const setContext = useCallback((ctx: Partial<RepoContextState>) => {
        setState(prev => ({ ...prev, ...ctx }));
    }, []);

    const clearContext = useCallback(() => {
        setState(defaultState);
    }, []);

    return (
        <RepoContext.Provider value={{ ...state, setContext, clearContext }}>
            {children}
        </RepoContext.Provider>
    );
}

export function useRepoContext() {
    const ctx = useContext(RepoContext);
    if (!ctx) {
        throw new Error("useRepoContext must be used within RepoProvider");
    }
    return ctx;
}
