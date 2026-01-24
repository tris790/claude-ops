import React, { createContext, useContext, useEffect, useState } from "react";
import { Spinner } from "../components/ui/Spinner";

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (orgUrl: string, pat: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    async function checkAuth() {
        try {
            const res = await fetch("/api/auth/status");
            if (res.ok) {
                const data = await res.json();
                setIsAuthenticated(data.isAuthenticated);
            }
        } catch (e) {
            console.error("Auth check failed", e);
        } finally {
            setIsLoading(false);
        }
    }

    async function login(orgUrl: string, pat: string) {
        const res = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgUrl, pat })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Setup failed");

        setIsAuthenticated(true);
    }

    if (isLoading) {
        return <div className="h-screen w-full flex items-center justify-center bg-zinc-950"><Spinner size="xl" /></div>;
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, login }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
