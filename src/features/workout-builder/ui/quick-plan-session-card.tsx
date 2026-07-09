"use client";

import { Play, Dumbbell, Loader2 } from "lucide-react";
import { useI18n } from "locales/client";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import type { DayRecommendationResult } from "@/features/training-science/actions/training-plan.action";

import { getAttributeValueLabel } from "@/shared/lib/attribute-value-translation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickPlanSessionCardProps {
  recommendation: DayRecommendationResult;
  selectedEquipmentCount: number;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
}

export function QuickPlanSessionCard({
  recommendation,
  selectedEquipmentCount,
  onGenerate,
  isGenerating,
  error,
}: QuickPlanSessionCardProps) {
  const t = useI18n();
  const canGenerate = selectedEquipmentCount > 0 && !isGenerating;

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white dark:border-sky-800 dark:from-sky-950/20 dark:to-slate-900">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t("workout_builder.plan_session.title")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("workout_builder.plan_session.subtitle")}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500">
            <Dumbbell className="h-6 w-6 text-white" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {recommendation.muscles.map((muscle: ExerciseAttributeValueEnum) => (
            <span
              className="rounded-md bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
              key={muscle}
            >
              {getAttributeValueLabel(muscle, t)}
            </span>
          ))}
        </div>

        <p className="text-xs text-slate-400">
          {t("workout_builder.plan_session.hint")}
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}

        <Button
          className="w-full bg-sky-500 text-white hover:bg-sky-600"
          disabled={!canGenerate}
          onClick={onGenerate}
          size="large"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Play className="mr-2 h-5 w-5" />
          )}
          {isGenerating
            ? t("workout_builder.plan_session.generating")
            : t("workout_builder.plan_session.generate")}
        </Button>
      </CardContent>
    </Card>
  );
}
