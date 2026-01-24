import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbsProps {
    project: string;
    repo: string;
    path?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ project, repo, path }) => {
    const parts = path ? path.split("/").filter(Boolean) : [];

    return (
        <div className="flex items-center text-sm text-zinc-400 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <Link to="/repos" className="hover:text-blue-400 transition-colors flex items-center">
                <Home size={14} />
            </Link>
            <ChevronRight size={14} className="mx-2 text-zinc-600" />

            <span className="text-zinc-400">
                {project}
            </span>
            <ChevronRight size={14} className="mx-2 text-zinc-600" />

            <Link to={`/repos`} className="hover:text-blue-400 transition-colors font-medium text-zinc-200">
                {repo}
            </Link>

            {parts.map((part, index) => {
                const isLast = index === parts.length - 1;
                return (
                    <React.Fragment key={index}>
                        <ChevronRight size={14} className="mx-2 text-zinc-600" />
                        <span className={isLast ? "text-zinc-100 font-medium" : ""}>
                            {part}
                        </span>
                    </React.Fragment>
                );
            })}
        </div>
    );
};
