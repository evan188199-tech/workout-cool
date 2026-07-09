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
  canGenerate: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
  onNeedEquipment?: VoidFunction;
}

export function QuickPlanSessionCard({
  recommendation,
  canGenerate,
  onGenerate,
  isGenerating,
  error,
  onNeedEquipment,
}: QuickPlanSessionCardProps) {
  const t = useI18n();
  const canGenerateNow = canGenerate && !isGenerating;
  const canNavigateToEquipment = !canGenerate && Boolean(onNeedEquipment);
  const handleGenerate = () => {
    if (canGenerate) {
      onGenerate();
      return;
    }
    onNeedEquipment?.();
  };
  const recommendationReason = recommendation.reasonI18nKey
    ? t(recommendation.reasonI18nKey, recommendation.reasonI18nValues ?? {})
    : recommendation.reason;
  const summaryRows = [
    {
      label: t("workout_builder.session.prescription_rest_label"),
      value: t("workout_builder.session.prescription_rest_value", { seconds: recommendation.prescription.restIntervalSeconds }),
      disabled: false,
    },
    {
      label: t("workout_builder.session.prescription_warmup_label"),
      value: recommendation.prescription.warmupRoutineEnabled
        ? t("workout_builder.session.prescription_warmup_value", {
            sets: recommendation.prescription.warmupExerciseCount,
            reps: recommendation.prescription.warmupReps,
          })
        : t("workout_builder.session.prescription_feature_disabled"),
      disabled: !recommendation.prescription.warmupRoutineEnabled,
    },
    {
      label: t("workout_builder.session.prescription_cooldown_label"),
      value: recommendation.prescription.cooldownRoutineEnabled
        ? t("workout_builder.session.prescription_cooldown_value", {
            sets: recommendation.prescription.cooldownExerciseCount,
            seconds: recommendation.prescription.cooldownHoldSeconds,
          })
        : t("workout_builder.session.prescription_feature_disabled"),
      disabled: !recommendation.prescription.cooldownRoutineEnabled,
    },
  ];

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
          <span className="rounded-md bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            {t("workout_builder.plan_session.duration_badge", { duration: recommendation.recommendedDurationMin })}
          </span>
          {recommendation.muscles.map((muscle: ExerciseAttributeValueEnum) => (
            <span
              className="rounded-md bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
              key={muscle}
            >
              {getAttributeValueLabel(muscle, t)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {summaryRows.map((row) => (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                row.disabled
                  ? "border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                  : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200"
              }`}
              key={row.label}
            >
              {row.label}: {row.value}
            </span>
          ))}
        </div>
        {recommendation.usesBodyweightMode ? (
          <p className="text-xs text-sky-700 dark:text-sky-200">
            {t("workout_builder.stepper_bodyweight_preference_notice")}
          </p>
        ) : null}

        <p className="text-xs text-slate-400">
          {t("workout_builder.plan_session.hint")}
        </p>
        <p className="text-xs text-slate-400">{recommendationReason}</p>

        {error && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            ⚠ {error}
          </p>
        )}

        {canNavigateToEquipment && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            {t("workout_builder.plan_session.requires_equipment")}
          </p>
        )}

        <Button
          className="w-full bg-sky-500 text-white hover:bg-sky-600"
          disabled={isGenerating || !canGenerateNow && !canNavigateToEquipment}
          onClick={handleGenerate}
          size="large"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Play className="mr-2 h-5 w-5" />
          )}
          {isGenerating
            ? t("workout_builder.plan_session.generating")
            : canGenerate
            ? t("workout_builder.plan_session.generate_with_duration", { duration: recommendation.recommendedDurationMin })
            : t("workout_builder.plan_session.configure_equipment")}
        </Button>
      </CardContent>
    </Card>
  );
}
