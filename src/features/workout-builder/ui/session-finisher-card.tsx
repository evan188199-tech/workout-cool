"use client";

import { Bike, Sparkles } from "lucide-react";

import type { SessionFinisher } from "@/features/training-science/model/session-finisher";

import { Card, CardContent } from "@/components/ui/card";

const FINISHER_ICONS: Record<SessionFinisher["type"], typeof Bike> = {
  cardio: Bike,
  mobility: Sparkles,
  nutrition: Sparkles,
};

/**
 * Dumb component: renders finisher cards from data. No business logic.
 * Reads the SessionFinisher[] array and displays each as a card.
 */
export function SessionFinisherCard({ finishers }: { finishers: SessionFinisher[] }) {
  if (finishers.length === 0) return null;

  return (
    <div className="space-y-2">
      {finishers.map((finisher, idx) => {
        const Icon = FINISHER_ICONS[finisher.type] ?? Sparkles;
        return (
          <Card key={idx} className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {finisher.title}
                  </span>
                  {finisher.durationMin && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                      {finisher.durationMin} min
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {finisher.rationale}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
