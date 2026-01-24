import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverable?: boolean;
}

export function Card({ children, className = "", hoverable, ...props }: CardProps) {
    return (
        <div
            className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 ${hoverable ? "hover:border-zinc-700 transition-colors" : ""
                } ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}
