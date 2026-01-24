import React, { useState } from "react";
import { cn } from "../utils/cn";
import {
    GitBranch,
    LayoutGrid,
    Settings,
    ChevronLeft,
    ChevronRight,
    Command,
    Search
} from "lucide-react";

interface MainLayoutProps {
    children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    return (
        <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside
                className={cn(
                    "relative flex flex-col border-r border-zinc-800 bg-zinc-900/50 transition-all duration-300 ease-in-out",
                    isSidebarCollapsed ? "w-16" : "w-[260px]"
                )}
            >
                {/* Sidebar Header */}
                <div className={cn(
                    "flex h-12 items-center border-b border-zinc-800/50",
                    isSidebarCollapsed ? "justify-center px-0" : "px-4"
                )}>
                    <div className="flex items-center gap-2 text-sapphire-500 font-bold">
                        <div className="p-1 bg-sapphire-500/10 rounded">
                            <Command className="h-5 w-5" />
                        </div>
                        {!isSidebarCollapsed && <span className="text-zinc-100 tracking-tight">ClaudeOps</span>}
                    </div>

                    {!isSidebarCollapsed && (
                        <button
                            onClick={() => setIsSidebarCollapsed(true)}
                            className="ml-auto p-1 rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                            aria-label="Collapse Sidebar"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                    <NavItem icon={<LayoutGrid />} label="Dashboard" collapsed={isSidebarCollapsed} active />
                    <NavItem icon={<GitBranch />} label="Repositories" collapsed={isSidebarCollapsed} />
                    <NavItem icon={<Search />} label="Search" collapsed={isSidebarCollapsed} />
                    <NavItem icon={<Settings />} label="Settings" collapsed={isSidebarCollapsed} />
                </nav>

                {/* Bottom Toggle (if collapsed) */}
                {isSidebarCollapsed && (
                    <div className="p-2 border-t border-zinc-800/50 flex justify-center">
                        <button
                            onClick={() => setIsSidebarCollapsed(false)}
                            className="p-1 rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
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
                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    <div className="mx-auto max-w-7xl h-full animate-fade-in">
                        {children}
                    </div>
                </main>

                {/* Status Bar */}
                <footer className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center px-3 text-xs text-zinc-500 select-none justify-between">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Connected</span>
                        </span>
                        <span className="hover:text-zinc-300 cursor-pointer flex items-center gap-1 transition-colors">
                            <GitBranch className="h-3 w-3" />
                            <span>main</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <span>UTF-8</span>
                        <span>TypeScript React</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function NavItem({ icon, label, collapsed, active }: { icon: React.ReactNode, label: string, collapsed: boolean, active?: boolean }) {
    return (
        <button
            className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-all text-sm font-medium group relative",
                active
                    ? "bg-sapphire-500/10 text-sapphire-400"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100",
                collapsed && "justify-center px-0"
            )}
            title={collapsed ? label : undefined}
        >
            {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, {
                className: cn("h-5 w-5 flex-shrink-0", active ? "text-sapphire-500" : "group-hover:text-zinc-100")
            })}
            {!collapsed && <span className="truncate">{label}</span>}
        </button>
    )
}
