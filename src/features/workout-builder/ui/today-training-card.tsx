"use client";

import { useRouter } from "next/navigation";
import { useCurrentLocale } from "locales/client";
import { Play, TrendingUp, Settings2 } from "lucide-react";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { useI18n } from "locales/client";
import { getAttributeValueLabel } from "@/shared/lib/attribute-value-translation";
import type { DayRecommendationResult } from "@/features/training-science/actions/training-plan.action";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { paths } from "@/shared/constants/paths";

interface TodayTrainingCardProps {
  recommendation: DayRecommendationResult | null;
  onStartDay: (dayNumber: number, muscles: ExerciseAttributeValueEnum[]) => void;
}

export function TodayTrainingCard({ recommendation, onStartDay }: TodayTrainingCardProps) {
  const t = useI18n();
  const router = useRouter();
  const locale = useCurrentLocale();

  if (!recommendation) return null;

  const handleStart = () => {
    onStartDay(recommendation.recommendedDay, recommendation.muscles);
  };

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-800 dark:from-emerald-950/30 dark:to-slate-900">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              Today: Day {recommendation.recommendedDay}
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
          {recommendation.muscles.map((muscle) => (
            <span
              key={muscle}
              className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              {getAttributeValueLabel(muscle, t)}
            </span>
          ))}
        </div>

        <p className="text-xs text-slate-400">{recommendation.reason}</p>

       <Button
         onClick={handleStart}
         className="w-full bg-emerald-500 text-white hover:bg-emerald-600"
         size="large"
       >
         <Play className="mr-2 h-5 w-5" />
         Start today&apos;s training
       </Button>

        <Link
          href={`/${locale}${paths.plan}`}
          className="flex items-center justify-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-emerald-600 dark:text-slate-400"
        >
          <Settings2 className="h-4 w-4" />
          Manage plan & progress
        </Link>
     </CardContent>
    </Card>
  );
}
