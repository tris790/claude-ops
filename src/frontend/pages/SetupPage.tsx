import React, { useState } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { Command } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export function SetupPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [orgUrl, setOrgUrl] = useState("");
    const [pat, setPat] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await login(orgUrl, pat);
            navigate("/repos");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen grid place-items-center bg-zinc-950 p-4 font-sans">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="inline-flex p-3 rounded-xl bg-sapphire-500/10 mb-4">
                        <Command className="h-10 w-10 text-sapphire-500" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to ClaudeOps</h2>
                    <p className="mt-2 text-zinc-400">Connect to your Azure DevOps organization to get started.</p>
                </div>

                <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Input
                                label="Organization URL"
                                placeholder="https://dev.azure.com/myorg"
                                value={orgUrl}
                                onChange={(e) => setOrgUrl(e.target.value)}
                                required
                            />

                            <div className="space-y-1">
                                <Input
                                    label="Personal Access Token (PAT)"
                                    type="password"
                                    placeholder="••••••••••••••••••••"
                                    value={pat}
                                    onChange={(e) => setPat(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-zinc-500">
                                    Requires <strong>Code (Read)</strong> and <strong>Work Items (Read/Write)</strong> scopes.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            isLoading={isLoading}
                        >
                            Connect Account
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
