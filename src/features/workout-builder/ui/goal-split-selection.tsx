"use client";

import { Dumbbell, Heart, Zap, Target, Calendar } from "lucide-react";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { useI18n } from "locales/client";
import { generateSplit, distributeVolumeForSplit, muscleFrequencyInSplit } from "@/features/training-science/model/split-generator";
import { getMuscleSize } from "@/features/training-science/model/weekly-volume";
import { getAttributeValueLabel } from "@/shared/lib/attribute-value-translation";
import type { TrainingGoal, DaysPerWeek } from "@/features/training-science/model/types";

import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface GoalSplitSelectionProps {
  selectedGoal: TrainingGoal;
  selectedDaysPerWeek: DaysPerWeek | null;
  onGoalChange: (goal: TrainingGoal) => void;
  onDaysChange: (days: DaysPerWeek | null) => void;
}

const GOAL_OPTIONS: { value: TrainingGoal; icon: typeof Dumbbell; labelKey: string }[] = [
  { value: "strength", icon: Dumbbell, labelKey: "training_science.goal.strength" },
  { value: "hypertrophy", icon: Zap, labelKey: "training_science.goal.hypertrophy" },
  { value: "endurance", icon: Heart, labelKey: "training_science.goal.endurance" },
  { value: "general", icon: Target, labelKey: "training_science.goal.general" },
];

const DAYS_OPTIONS: DaysPerWeek[] = [2, 3, 4, 5];

export function GoalSplitSelection({
  selectedGoal,
  selectedDaysPerWeek,
  onGoalChange,
  onDaysChange,
}: GoalSplitSelectionProps) {
  const t = useI18n();

  return (
    <div className="space-y-6">
      <GoalPicker selectedGoal={selectedGoal} onGoalChange={onGoalChange} t={t} />
      <DaysPicker selectedDaysPerWeek={selectedDaysPerWeek} onDaysChange={onDaysChange} t={t} />
      {selectedDaysPerWeek && (
        <SplitPreview daysPerWeek={selectedDaysPerWeek} goal={selectedGoal} t={t} />
      )}
    </div>
  );
}

function GoalPicker({
  selectedGoal,
  onGoalChange,
  t,
}: {
  selectedGoal: TrainingGoal;
  onGoalChange: (g: TrainingGoal) => void;
  t: ReturnType<typeof useI18n>;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
        <Target className="inline h-4 w-4 mr-1.5" />
        {t("training_science.select_goal")}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GOAL_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selectedGoal === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onGoalChange(opt.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                isSelected
                  ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800",
              )}
            >
              <Icon className={cn("h-6 w-6", isSelected ? "text-emerald-500" : "text-slate-400")} />
              <span className={cn("text-xs font-medium", isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-400")}>
                {t(opt.labelKey as keyof typeof t)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DaysPicker({
  selectedDaysPerWeek,
  onDaysChange,
  t,
}: {
  selectedDaysPerWeek: DaysPerWeek | null;
  onDaysChange: (d: DaysPerWeek | null) => void;
  t: ReturnType<typeof useI18n>;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
        <Calendar className="inline h-4 w-4 mr-1.5" />
        {t("training_science.select_days")}
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
  );
}

function SplitPreview({
  daysPerWeek,
  goal,
  t,
}: {
  daysPerWeek: DaysPerWeek;
  goal: TrainingGoal;
  t: ReturnType<typeof useI18n>;
}) {
  const split = generateSplit(daysPerWeek);
  const distributions = distributeVolumeForSplit(split, goal);
  const freqMap = muscleFrequencyInSplit(split);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
        {t("training_science.split_preview")}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {split.days.map((day, idx) => {
          const dist = distributions[idx];
          return (
            <Card key={day.dayNumber} className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                    {day.dayNumber}
                  </span>
                  <span className="text-sm font-semibold capitalize">
                    {t(day.labelKey as keyof typeof t)}
                  </span>
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
        {t("training_science.split_hint")}
      </p>
    </div>
  );
}
