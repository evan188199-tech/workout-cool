"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useWorkoutSession } from "@/features/workout-builder";

export function RestTimer() {
  const { restSeconds, isRestActive, stopRest, tickRest } = useWorkoutSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRestActive || restSeconds <= 0) return;

    intervalRef.current = setInterval(() => {
      tickRest();
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRestActive]);

  if (!isRestActive || restSeconds <= 0) return null;

  return (
    <div className="fixed bottom-44 sm:bottom-28 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-4 rounded-full bg-blue-500 px-6 py-3 text-white shadow-lg">
        <div className="text-center">
          <div className="text-xs font-medium opacity-80">Rest</div>
          <div className="text-2xl font-mono font-bold tabular-nums">{restSeconds}s</div>
        </div>
        <button
          onClick={stopRest}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          aria-label="Skip rest"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
