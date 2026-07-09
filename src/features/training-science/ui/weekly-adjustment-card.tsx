"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Zap, Check, Loader2 } from "lucide-react";
import { useI18n } from "locales/client";


import { getWeeklyAdjustment } from "../actions/get-weekly-adjustment.action";
import { applyWeeklyAdjustment } from "../actions/apply-weekly-adjustment.action";

import type { WeeklyAdjustmentResult, AdjustmentAction } from "../model/weekly-adjustment";

import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface WeeklyAdjustmentCardProps {
  tzOffsetMinutes: number;
}

const ACTION_STYLES: Record<AdjustmentAction, { bg: string; icon: typeof TrendingUp; color: string }> = {
  increase_frequency: { bg: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20", icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
  reduce_volume: { bg: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20", icon: Zap, color: "text-amber-600 dark:text-amber-400" },
  deload: { bg: "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20", icon: Zap, color: "text-orange-600 dark:text-orange-400" },
  reduce_frequency: { bg: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20", icon: TrendingDown, color: "text-blue-600 dark:text-blue-400" },
  maintain: { bg: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50", icon: TrendingUp, color: "text-slate-500 dark:text-slate-400" },
  no_data: { bg: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50", icon: TrendingUp, color: "text-slate-500 dark:text-slate-400" },
};

export function WeeklyAdjustmentCard({ tzOffsetMinutes }: WeeklyAdjustmentCardProps) {
  const t = useI18n();
  const [data, setData] = useState<WeeklyAdjustmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    getWeeklyAdjustment(tzOffsetMinutes).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [tzOffsetMinutes]);

  if (loading || !data) return null;
  if (!data.applyable && data.action === "no_data") return null;
  if (data.action === "maintain" && data.volumeFactor === 1.0) return null;

  const style = ACTION_STYLES[data.action];
  const Icon = style.icon;
  const showApplyButton =
    (data.action === "increase_frequency" || data.action === "reduce_frequency") && !applied;

  const handleApply = async () => {
    setApplying(true);
    const result = await applyWeeklyAdjustment(data.newDaysPerWeek as 2 | 3 | 4 | 5);
    if (result.success) {
      setApplied(true);
    }
    setApplying(false);
  };

  return (
    <Card className={cn("transition-all", style.bg)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 shrink-0", style.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("workout_builder.weekly_adjustment.title")}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{data.reason}</p>
          </div>
        </div>

        {showApplyButton && (
          <div className="flex items-center gap-2 pl-8">
            <Button
              className={cn("bg-emerald-500 hover:bg-emerald-600")}
              disabled={applying}
              onClick={handleApply}
              size="small"
              variant="default"
            >
              {applying ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : applied ? (
                <Check className="mr-1.5 h-4 w-4" />
              ) : null}
              {applied
                ? t("workout_builder.weekly_adjustment.applied")
                : t("workout_builder.weekly_adjustment.apply")}
            </Button>
            <span className="text-xs text-slate-400">
              {data.newDaysPerWeek} {t("workout_builder.weekly_adjustment.days_per_week")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
