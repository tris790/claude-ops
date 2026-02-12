import React from "react";
import { cn } from "../utils/cn";
import {
    GitBranch,
    LayoutGrid,
    Settings,
    ChevronLeft,
    ChevronRight,
    Command,
    Search,
    ListTodo,
    Activity,
    FolderGit
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { CommandPalette } from "../components/CommandPalette";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useRepoContext } from "../contexts/RepoContext";

interface MainLayoutProps {
    children: React.ReactNode;
}

function getLanguageDisplayName(language: string | null): string {
    if (!language) return "Plain Text";
    const displayNames: Record<string, string> = {
        typescript: "TypeScript",
        typescriptreact: "TypeScript React",
        go: "Go",
        python: "Python",
        c: "C",
        cpp: "C++",
        csharp: "C#",
    };
    return displayNames[language] || language.charAt(0).toUpperCase() + language.slice(1);
}

export function MainLayout({ children }: MainLayoutProps) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage("sidebar-collapsed", false);
    const { project, repo, branch, language } = useRepoContext();

    return (
        <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
            <CommandPalette />
            {/* Sidebar */}
            <aside
                className={cn(
                    "relative flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 transition-all duration-300 ease-in-out",
                    isSidebarCollapsed ? "w-16" : "w-[260px]"
                )}
            >
                {/* Sidebar Header */}
                <div className={cn(
                    "flex h-12 items-center border-b border-zinc-200/50 dark:border-zinc-800/50",
                    isSidebarCollapsed ? "justify-center px-0" : "px-4"
                )}>
                    <NavLink to="/repos" className="flex items-center gap-2 text-sapphire-500 font-bold hover:opacity-80 transition-opacity">
                        <div className="p-1 bg-sapphire-500/10 rounded">
                            <Command className="h-5 w-5" />
                        </div>
                        {!isSidebarCollapsed && <span className="text-zinc-900 dark:text-zinc-100 tracking-tight">ClaudeOps</span>}
                    </NavLink>

                    {!isSidebarCollapsed && (
                        <button
                            onClick={() => setIsSidebarCollapsed(true)}
                            className="ml-auto p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                            aria-label="Collapse Sidebar"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                    <NavItem to="/repos" icon={<LayoutGrid />} label="Repositories" collapsed={isSidebarCollapsed} />
                    <NavItem to="/workitems" icon={<ListTodo />} label="Work Items" collapsed={isSidebarCollapsed} />
                    <NavItem to="/prs" icon={<GitBranch />} label="Pull Requests" collapsed={isSidebarCollapsed} />
                    <NavItem to="/pipelines" icon={<Activity />} label="Pipelines" collapsed={isSidebarCollapsed} />
                    <NavItem to="/search" icon={<Search />} label="Search" collapsed={isSidebarCollapsed} />
                    <NavItem to="/settings" icon={<Settings />} label="Settings" collapsed={isSidebarCollapsed} />
                </nav>

                {/* Bottom Toggle (if collapsed) */}
                {isSidebarCollapsed && (
                    <div className="p-2 border-t border-zinc-200/50 dark:border-zinc-800/50 flex justify-center">
                        <button
                            onClick={() => setIsSidebarCollapsed(false)}
                            className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                            aria-label="Expand Sidebar"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* Main Stage */}
                <main className="flex-1 overflow-y-auto scrollbar-thin">
                    <div className="h-full w-full animate-fade-in">
                        {children}
                    </div>
                </main>

                {/* Status Bar */}
                <footer className="h-6 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center px-3 text-xs text-zinc-500 select-none justify-between">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Connected</span>
                        </span>
                        {repo && (
                            <span className="flex items-center gap-1 transition-colors">
                                <FolderGit className="h-3 w-3" />
                                <span>{project}/{repo}</span>
                            </span>
                        )}
                        {branch && (
                            <span className="hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer flex items-center gap-1 transition-colors">
                                <GitBranch className="h-3 w-3" />
                                <span>{branch}</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <span>UTF-8</span>
                        {language && <span>{getLanguageDisplayName(language)}</span>}
                    </div>
                </footer>
            </div>
        </div>
    );
}

function NavItem({ to, icon, label, collapsed }: { to: string, icon: React.ReactNode, label: string, collapsed: boolean }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-all text-sm font-medium group relative",
                isActive
                    ? "bg-sapphire-500/10 text-sapphire-400"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100",
                collapsed && "justify-center px-0"
            )}
            title={collapsed ? label : undefined}
        >
            {({ isActive }) => (
                <>
                    {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, {
                        className: cn("h-5 w-5 flex-shrink-0", isActive ? "text-sapphire-500" : "group-hover:text-zinc-900 dark:group-hover:text-zinc-100")
                    })}
                    {!collapsed && <span className="truncate">{label}</span>}
                </>
            )}
        </NavLink>
    )
}
