import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface MultiSelectOption {
    label: string;
    value: string;
    count?: number; // Optional count to show next to the label
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    selected: string[] | string;
    onChange: (selected: any) => void;
    placeholder?: string;
    className?: string;
    searchPlaceholder?: string;
    multiple?: boolean;
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = 'Select...',
    className,
    searchPlaceholder = 'Search...',
    multiple = true
}: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const isSelected = (value: string) => {
        if (multiple) {
            return (selected as string[]).includes(value);
        }
        return selected === value;
    };

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options;
        const query = searchQuery.toLowerCase();
        return options.filter(option =>
            option.label.toLowerCase().includes(query)
        );
    }, [options, searchQuery]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        if (multiple) {
            const currentSelected = selected as string[];
            const newSelected = currentSelected.includes(value)
                ? currentSelected.filter(v => v !== value)
                : [...currentSelected, value];
            onChange(newSelected);
        } else {
            onChange(value);
            setIsOpen(false);
        }
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(multiple ? [] : "");
    };

    const removeOption = (value: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (multiple) {
            onChange((selected as string[]).filter(v => v !== value));
        } else {
            onChange("");
        }
    }

    // Determine label to display on the button
    const getDisplayLabel = () => {
        if (multiple) {
            const currentSelected = selected as string[];
            if (currentSelected.length === 0) return placeholder;
            if (currentSelected.length === 1) {
                const option = options.find(o => o.value === currentSelected[0]);
                return option ? option.label : currentSelected[0];
            }
            return `${currentSelected.length} selected`;
        } else {
            const option = options.find(o => o.value === selected);
            return option ? option.label : (selected as string || placeholder);
        }
    };

    return (
        <div className={cn("relative min-w-[150px]", className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md shadow-sm transition-colors text-sm",
                    "hover:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500",
                    isOpen && "border-blue-500 ring-1 ring-blue-500"
                )}
            >
                <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                    {multiple ? (
                        (selected as string[]).length > 0 ? (
                            <div className="flex gap-1 overflow-hidden">
                                {(selected as string[]).slice(0, 2).map(val => {
                                    const opt = options.find(o => o.value === val);
                                    return (
                                        <span key={val} className="text-xs bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <span className="truncate max-w-[80px]">{opt?.label || val}</span>
                                            <X
                                                className="h-3 w-3 hover:text-white cursor-pointer"
                                                onClick={(e) => removeOption(val, e)}
                                            />
                                        </span>
                                    )
                                })}
                                {(selected as string[]).length > 2 && (
                                    <span className="text-xs text-zinc-400 py-0.5">+{(selected as string[]).length - 2}</span>
                                )}
                            </div>
                        ) : (
                            <span className="text-zinc-500 truncate">{placeholder}</span>
                        )
                    ) : (
                        <span className={cn("truncate", !selected ? "text-zinc-500" : "text-zinc-200")}>
                            {getDisplayLabel()}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                    {((multiple && (selected as string[]).length > 0) || (!multiple && selected)) && (
                        <div
                            onClick={clearSelection}
                            className="p-0.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </div>
                    )}
                    <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", isOpen && "transform rotate-180")} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-lg max-h-80 flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm sticky top-0 z-10">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-sm text-zinc-500">
                                No options found.
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {filteredOptions.map((option) => {
                                    const active = isSelected(option.value);
                                    return (
                                        <div
                                            key={option.value}
                                            onClick={() => toggleOption(option.value)}
                                            className={cn(
                                                "flex items-center justify-between px-2 py-2 cursor-pointer rounded text-sm group transition-colors",
                                                active ? "bg-blue-600/10 text-blue-400" : "text-zinc-300 hover:bg-zinc-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {multiple && (
                                                    <div className={cn(
                                                        "h-4 w-4 border rounded flex items-center justify-center transition-colors shrink-0",
                                                        active ? "bg-blue-500 border-blue-500" : "border-zinc-600 group-hover:border-zinc-500"
                                                    )}>
                                                        {active && <Check className="h-3 w-3 text-white" />}
                                                    </div>
                                                )}
                                                {!multiple && active && (
                                                    <Check className="h-4 w-4 text-blue-500 shrink-0" />
                                                )}
                                                <span className="truncate">{option.label}</span>
                                            </div>
                                            {option.count !== undefined && (
                                                <span className="text-xs text-zinc-600 font-mono ml-2">{option.count}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer showing count for multi selection */}
                    {multiple && (selected as string[]).length > 0 && (
                        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500 flex justify-between items-center">
                            <span>{(selected as string[]).length} selected</span>
                            <button
                                onClick={() => onChange([])}
                                className="text-blue-500 hover:text-blue-400 font-medium"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

