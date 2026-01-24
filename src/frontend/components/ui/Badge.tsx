import React from 'react';

type BadgeVariant = 'default' | 'outline' | 'secondary' | 'destructive' | 'success' | 'warning';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
    const variants = {
        default: "bg-sapphire-600/10 text-sapphire-500 border-sapphire-600/20",
        secondary: "bg-zinc-800 text-zinc-400 border-zinc-700",
        outline: "bg-transparent text-zinc-300 border-zinc-700",
        destructive: "bg-red-900/20 text-red-500 border-red-900/30",
        success: "bg-emerald-900/20 text-emerald-500 border-emerald-900/30",
        warning: "bg-amber-900/20 text-amber-500 border-amber-900/30",
    };

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
            {...props}
        />
    );
}
