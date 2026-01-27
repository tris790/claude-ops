import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    label?: string;
}

export function Input({ className = "", error, label, id, ...props }: InputProps) {
    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-xs font-medium text-zinc-400 mb-1">
                    {label}
                </label>
            )}
            <input
                id={id}
                className={`w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sapphire-600/50 focus:border-sapphire-600 transition-all ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/50" : ""
                    } ${className}`}
                {...props}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
}
