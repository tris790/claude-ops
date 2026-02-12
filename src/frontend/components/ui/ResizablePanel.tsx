import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocalStorage } from "../../hooks/useLocalStorage";

interface ResizablePanelProps {
    children: React.ReactNode;
    direction: "horizontal" | "vertical";
    defaultSize: number;
    minSize?: number;
    maxSize?: number;
    storageKey: string;
    className?: string;
    resizerClassName?: string;
    onResize?: (size: number) => void;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
    children,
    direction,
    defaultSize,
    minSize = 100,
    maxSize,
    storageKey,
    className = "",
    resizerClassName = "",
    onResize
}) => {
    const [size, setSize] = useLocalStorage(storageKey, defaultSize);
    const [isResizing, setIsResizing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Use refs for smooth resize without React re-renders
    const panelRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const currentSizeRef = useRef(size);
    const startPosRef = useRef(0);
    const startSizeRef = useRef(size);

    const isHorizontal = direction === "horizontal";

    // Keep refs in sync
    useEffect(() => {
        currentSizeRef.current = size;
    }, [size]);

    const applySize = useCallback((newSize: number) => {
        const clampedSize = maxSize
            ? Math.max(minSize, Math.min(newSize, maxSize))
            : Math.max(minSize, newSize);

        if (panelRef.current) {
            panelRef.current.style.width = isHorizontal ? `${clampedSize}px` : "";
            panelRef.current.style.height = !isHorizontal ? `${clampedSize}px` : "";
        }

        currentSizeRef.current = clampedSize;
    }, [isHorizontal, minSize, maxSize]);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        startPosRef.current = isHorizontal ? e.clientX : e.clientY;
        startSizeRef.current = currentSizeRef.current;
        setIsResizing(true);
        setIsDragging(true);
    }, [isHorizontal]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (rafRef.current) return;

            rafRef.current = requestAnimationFrame(() => {
                const currentPos = isHorizontal ? e.clientX : e.clientY;
                const delta = currentPos - startPosRef.current;

                const newSize = isHorizontal
                    ? startSizeRef.current + delta
                    : startSizeRef.current - delta;

                applySize(newSize);
                rafRef.current = null;
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);

            // Commit final size to React state (triggers single re-render)
            setSize(currentSizeRef.current);
            onResize?.(currentSizeRef.current);

            // Cleanup RAF
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };

        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        window.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isDragging, isHorizontal, minSize, maxSize, setSize, onResize, applySize]);

    const sizeStyle = isHorizontal
        ? { width: `${size}px` }
        : { height: `${size}px` };

    const resizerStyles = isHorizontal
        ? "absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-10 group"
        : "absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-10 group";

    const handleStyles = isHorizontal
        ? `h-full w-1 transition-colors ${isResizing ? "bg-blue-500" : "bg-transparent group-hover:bg-blue-500/50"}`
        : `w-full h-1 transition-colors ${isResizing ? "bg-blue-500" : "bg-transparent group-hover:bg-blue-500/50"}`;

    return (
        <div
            ref={panelRef}
            className={`relative flex ${isHorizontal ? "flex-row" : "flex-col"} ${className}`}
            style={sizeStyle}
        >
            <div className="flex-1 overflow-hidden">
                {children}
            </div>
            <div
                className={`${resizerStyles} ${resizerClassName}`}
                onMouseDown={startResizing}
            >
                <div className={handleStyles} />
            </div>
        </div>
    );
};

export default ResizablePanel;
