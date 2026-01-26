import { useEffect, useRef } from "react";

interface PollingOptions {
    activeInterval?: number;
    backgroundInterval?: number | "pause";
    enabled?: boolean;
    immediate?: boolean;
}

/**
 * A hook that executes a callback at specified intervals, 
 * adjusting the frequency based on page visibility.
 */
export function usePolling(
    callback: () => void | Promise<void>,
    {
        activeInterval = 5000,
        backgroundInterval = 30000,
        enabled = true,
        immediate = false,
    }: PollingOptions = {}
) {
    const callbackRef = useRef(callback);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Update the ref when callback changes so we don't have to restart the effect
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            return;
        }

        const poll = async () => {
            try {
                await callbackRef.current();
            } finally {
                scheduleNext();
            }
        };

        const scheduleNext = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            const isVisible = document.visibilityState === "visible";
            const currentInterval = isVisible ? activeInterval : backgroundInterval;

            if (currentInterval !== "pause") {
                timeoutRef.current = setTimeout(poll, currentInterval);
            } else {
                timeoutRef.current = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // Return to active polling immediately when page becomes visible
                poll();
            } else if (backgroundInterval === "pause") {
                // Stop polling if background interval is set to pause
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            } else {
                // Adjust to background frequency
                scheduleNext();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        if (immediate) {
            poll();
        } else {
            scheduleNext();
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [enabled, activeInterval, backgroundInterval, immediate]);
}
