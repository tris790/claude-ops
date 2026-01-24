import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className = "", variant = "text", ...props }: SkeletonProps) {
    const variants = {
        text: "rounded",
        circular: "rounded-full",
        rectangular: "rounded-md",
    };

    return (
        <div
            className={`animate-pulse bg-zinc-800/50 ${variants[variant]} ${className}`}
            {...props}
        />
    );
}
