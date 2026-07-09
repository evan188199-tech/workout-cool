"use client";

import { Clock, Zap, Play } from "lucide-react";
import { useI18n } from "locales/client";

import type { QuickTimeBudget } from "@/features/training-science/model/quick-session";

import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TIME_OPTIONS: { value: QuickTimeBudget; label: string }[] = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
];

interface QuickTrainingCardProps {
  selectedTimeBudget: QuickTimeBudget;
  onTimeBudgetChange: (budget: QuickTimeBudget) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
}

export function QuickTrainingCard({
  selectedTimeBudget,
  onTimeBudgetChange,
  onGenerate,
  isGenerating,
  error,
}: QuickTrainingCardProps) {
  const t = useI18n();

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-800 dark:from-amber-950/20 dark:to-slate-900">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t("workout_builder.quick.title")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("workout_builder.quick.subtitle")}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400">
            <Zap className="h-6 w-6 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <Clock className="inline h-3.5 w-3.5 mr-1" />
            {t("workout_builder.quick.time_label")}
          </p>
          <div className="flex gap-2">
            {TIME_OPTIONS.map((option) => (
              <button
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  selectedTimeBudget === option.value
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
                )}
                disabled={isGenerating}
                key={option.value}
                onClick={() => onTimeBudgetChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">{t("workout_builder.quick.hint")}</p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}

        <Button
          className="w-full bg-amber-500 text-white hover:bg-amber-600"
          disabled={isGenerating}
          onClick={onGenerate}
          size="large"
        >
          <Play className="mr-2 h-5 w-5" />
          {isGenerating ? t("workout_builder.quick.generating") : t("workout_builder.quick.generate")}
        </Button>
      </CardContent>
    </Card>
  );
}
