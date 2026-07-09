"use client";

import { Loader2, Play, Settings2, TrendingUp } from "lucide-react";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { useCurrentLocale, useI18n } from "locales/client";
import { getAttributeValueLabel } from "@/shared/lib/attribute-value-translation";
import type { DayRecommendationResult } from "@/features/training-science/actions/training-plan.action";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { paths } from "@/shared/constants/paths";

interface TodayTrainingCardProps {
  recommendation: DayRecommendationResult | null;
  onStartDay: (dayNumber: number, muscles: ExerciseAttributeValueEnum[]) => void;
  isGenerating?: boolean;
  canGenerate?: boolean;
  onRequireEquipment?: VoidFunction;
}

export function TodayTrainingCard({
  recommendation,
  onStartDay,
  isGenerating = false,
  canGenerate = true,
  onRequireEquipment,
}: TodayTrainingCardProps) {
  const t = useI18n();
  const locale = useCurrentLocale();

  if (!recommendation) return null;

  const handleStart = () => {
    if (isGenerating) return;
    if (!canGenerate) {
      onRequireEquipment?.();
      return;
    }
    onStartDay(recommendation.recommendedDay, recommendation.muscles);
  };
  const canStartNow = canGenerate || Boolean(onRequireEquipment);
  const recommendationReason = recommendation.reasonI18nKey
    ? t(recommendation.reasonI18nKey, recommendation.reasonI18nValues ?? {})
    : recommendation.reason;
  const durationRangeText = recommendation.recommendedDurationRange.min === recommendation.recommendedDurationRange.max
    ? null
    : t("workout_builder.plan_session.duration_range", {
        min: recommendation.recommendedDurationRange.min,
        max: recommendation.recommendedDurationRange.max,
      });
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
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-800 dark:from-emerald-950/30 dark:to-slate-900">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t("workout_builder.plan_session.today_title", { day: recommendation.recommendedDay })}
            </h2>
            <p className="text-sm capitalize text-slate-500 dark:text-slate-400">
              {recommendation.splitType.replace(/-/g, " ")} · {recommendation.intent.replace(/_/g, " ")}
            </p>
          </div>
         <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
           <TrendingUp className="h-6 w-6 text-white" />
         </div>
       </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {t("workout_builder.plan_session.target_duration", { duration: recommendation.recommendedDurationMin })}
          </span>
          {recommendation.muscles.map((muscle) => (
            <span
              key={muscle}
              className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              {getAttributeValueLabel(muscle, t)}
            </span>
          ))}
        </div>
        {durationRangeText ? (
          <p className="text-xs text-slate-500">{durationRangeText}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {summaryRows.map((row) => (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                row.disabled
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              }`}
              key={row.label}
            >
              {row.label}: {row.value}
            </span>
          ))}
        </div>
        {recommendation.usesBodyweightMode ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-200">{t("workout_builder.stepper_bodyweight_preference_notice")}</p>
        ) : null}

        {!canGenerate && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            {t("workout_builder.plan_session.requires_equipment")}
          </p>
        )}

        <p className="text-xs text-slate-400">{recommendationReason}</p>
        {recommendation.fatigue.zone === "red" && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            {recommendation.fatigue.message}
          </p>
        )}
        {recommendation.fatigue.recoveryHint && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
            {recommendation.fatigue.recoveryHint}
          </p>
        )}

      <Button
        className="w-full bg-emerald-500 text-white hover:bg-emerald-600"
        disabled={!canStartNow || isGenerating}
        onClick={handleStart}
        size="large"
      >
        {isGenerating ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Play className="mr-2 h-5 w-5" />
        )}
        {isGenerating
          ? t("workout_builder.plan_session.generating")
          : t("workout_builder.plan_session.start_today_with_duration", { duration: recommendation.recommendedDurationMin })}
      </Button>

        <Link
          href={`/${locale}${paths.plan}`}
          className="flex items-center justify-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-emerald-600 dark:text-slate-400"
        >
          <Settings2 className="h-4 w-4" />
          {t("workout_builder.plan_session.manage_plan")}
        </Link>
     </CardContent>
    </Card>
  );
}
