import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverable?: boolean;
}

export function Card({ children, className = "", hoverable, ...props }: CardProps) {
    return (
        <div
            className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 ${hoverable ? "hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors" : ""
                } ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}
