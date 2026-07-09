"use client";

import { useState } from "react";
import { Dumbbell, Flame, Heart, Zap, Target, Calendar, Check } from "lucide-react";

import { ExerciseAttributeValueEnum } from "@prisma/client";
import { useI18n } from "locales/client";
import { generateSplit, distributeVolumeForSplit, muscleFrequencyInSplit } from "@/features/training-science/model/split-generator";
import { getAttributeValueLabel } from "@/shared/lib/attribute-value-translation";
import { intentToTrainingGoal } from "@/features/training-science/model/user-intent";
import type { UserIntent } from "@/features/training-science/model/user-intent";
import type { DaysPerWeek } from "@/features/training-science/model/types";

import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface GoalSplitSelectionProps {
  selectedIntent: UserIntent;
  selectedDaysPerWeek: DaysPerWeek | null;
  onIntentChange: (intent: UserIntent) => void;
  onDaysChange: (days: DaysPerWeek | null) => void;
  selectedSplitDay: number | null;
  onSelectSplitDay: (dayNumber: number, muscles: ExerciseAttributeValueEnum[]) => void;
}

const INTENT_OPTIONS: { value: UserIntent; icon: typeof Dumbbell; label: string }[] = [
  { value: "build_strength", icon: Dumbbell, label: "Get stronger" },
  { value: "build_muscle", icon: Zap, label: "Build muscle" },
  { value: "lose_fat", icon: Flame, label: "Lose fat" },
  { value: "improve_endurance", icon: Heart, label: "Endurance" },
  { value: "general_fitness", icon: Target, label: "Stay fit" },
];

const DAYS_OPTIONS: DaysPerWeek[] = [2, 3, 4, 5];

export function GoalSplitSelection({
  selectedIntent,
  selectedDaysPerWeek,
  onIntentChange,
  onDaysChange,
  selectedSplitDay,
  onSelectSplitDay,
}: GoalSplitSelectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
          <Target className="inline h-4 w-4 mr-1.5" />
          What is your goal?
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {INTENT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedIntent === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onIntentChange(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                  isSelected
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800",
                )}
              >
                <Icon className={cn("h-6 w-6", isSelected ? "text-emerald-500" : "text-slate-400")} />
                <span className={cn("text-xs font-medium", isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-400")}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
          <Calendar className="inline h-4 w-4 mr-1.5" />
          Days per week
        </h3>
        <div className="flex flex-wrap gap-2">
          {DAYS_OPTIONS.map((days) => (
            <Button
              key={days}
              onClick={() => onDaysChange(selectedDaysPerWeek === days ? null : days)}
              variant={selectedDaysPerWeek === days ? "default" : "outline"}
              className={cn("min-w-[3.5rem]", selectedDaysPerWeek === days && "bg-emerald-500 hover:bg-emerald-600")}
            >
              {days}
            </Button>
          ))}
        </div>
      </div>

      {selectedDaysPerWeek && (
        <SplitPreview
          daysPerWeek={selectedDaysPerWeek}
          intent={selectedIntent}
          selectedSplitDay={selectedSplitDay}
          onSelectSplitDay={onSelectSplitDay}
        />
      )}
    </div>
  );
}

function SplitPreview({
  daysPerWeek,
  intent,
  selectedSplitDay,
  onSelectSplitDay,
}: {
  daysPerWeek: DaysPerWeek;
  intent: UserIntent;
  selectedSplitDay: number | null;
  onSelectSplitDay: (dayNumber: number, muscles: ExerciseAttributeValueEnum[]) => void;
}) {
  const t = useI18n();
  const goal = intentToTrainingGoal(intent);
  const split = generateSplit(daysPerWeek);
  const distributions = distributeVolumeForSplit(split, goal);
  const freqMap = muscleFrequencyInSplit(split);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
        Pick today&apos;s training day
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {split.days.map((day, idx) => {
          const dist = distributions[idx];
          const isSelected = selectedSplitDay === day.dayNumber;
          return (
            <Card
              key={day.dayNumber}
              className={cn(
                "cursor-pointer transition-all",
                isSelected
                  ? "border-2 border-emerald-500 shadow-md"
                  : "border-slate-200 hover:border-emerald-300 dark:border-slate-700",
              )}
              onClick={() => onSelectSplitDay(day.dayNumber, day.muscles)}
            >
              <CardContent className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white",
                        isSelected ? "bg-emerald-500" : "bg-slate-400",
                      )}
                    >
                      {isSelected ? <Check className="h-3 w-3" /> : day.dayNumber}
                    </span>
                    <span className="text-sm font-semibold capitalize">
                      {day.labelKey.split(".").pop()?.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dist.map((alloc) => {
                    const freq = freqMap.get(alloc.muscle) ?? 1;
                    return (
                      <span
                        key={alloc.muscle}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      >
                        {getAttributeValueLabel(alloc.muscle, t)} {alloc.setsThisDay}
                        {freq > 1 && <span className="text-emerald-500">x{freq}</span>}
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">
        Tap a day to load its muscles. You can fine-tune them in the next step.
      </p>
    </div>
  );
}
