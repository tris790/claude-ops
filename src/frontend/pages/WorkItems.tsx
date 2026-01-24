import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyWorkItems } from "../api/work-items";
import {
    CheckCircle2,
    Circle,
    Clock,
    Tag,
    ChevronRight
} from "lucide-react";
import { cn } from "../utils/cn";

export function WorkItems() {
    const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("my");

    useEffect(() => {
        loadItems();
    }, [filter]);

    async function loadItems() {
        setLoading(true);
        try {
            // In a real app we'd pass the filter to the API
            const data = await getMyWorkItems();
            setItems(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const getStatusIcon = (state: string) => {
        switch (state.toLowerCase()) {
            case "active": return <Clock className="h-4 w-4 text-blue-500" />;
            case "closed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case "new": return <Circle className="h-4 w-4 text-zinc-500" />;
            case "resolved": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
            default: return <Circle className="h-4 w-4 text-zinc-500" />;
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Work Items</h1>
                    <p className="text-zinc-500 text-sm mt-1">Track and manage your tasks across projects.</p>
                </div>
                <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    <button
                        onClick={() => setFilter("my")}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            filter === "my" ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        Assigned to Me
                    </button>
                    <button
                        onClick={() => setFilter("recent")}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            filter === "recent" ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        Recently Updated
                    </button>
                </div>
            </header>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-20">ID</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Title</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-32">State</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-40">Assigned To</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/30">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-4 py-4"><div className="h-4 bg-zinc-800 rounded w-12" /></td>
                                        <td className="px-4 py-4"><div className="h-4 bg-zinc-800 rounded w-3/4" /></td>
                                        <td className="px-4 py-4"><div className="h-4 bg-zinc-800 rounded w-20" /></td>
                                        <td className="px-4 py-4"><div className="h-4 bg-zinc-800 rounded w-24" /></td>
                                        <td className="px-4 py-4" />
                                    </tr>
                                ))
                            ) : items.length > 0 ? (
                                items.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => navigate(`/workitems/${item.id}`)}
                                        className="group hover:bg-white/5 transition-colors cursor-pointer border-zinc-800/30"
                                    >
                                        <td className="px-4 py-4 text-sm text-zinc-500 font-mono">#{item.id}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-zinc-200 font-medium group-hover:text-blue-400 transition-colors">
                                                    {item.fields["System.Title"]}
                                                </span>
                                                <span className="text-xs text-zinc-500 mt-0.5">{item.fields["System.WorkItemType"]}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(item.fields["System.State"])}
                                                <span className="text-sm text-zinc-300">{item.fields["System.State"]}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {item.fields["System.AssignedTo"] ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 lowercase">
                                                        {item.fields["System.AssignedTo"].displayName[0]}
                                                    </div>
                                                    <span className="text-sm text-zinc-400">{item.fields["System.AssignedTo"].displayName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-zinc-600 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-zinc-600">
                                            <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Tag className="h-8 w-8 text-zinc-800" />
                                            <p className="text-zinc-500">No work items found.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
