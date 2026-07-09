"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, Play, CheckCircle2, Calendar, Target, Pencil } from "lucide-react";

import { useI18n } from "locales/client";
import { generateSplit, distributeVolumeForSplit, muscleFrequencyInSplit } from "@/features/training-science/model/split-generator";
import { getAttributeValueLabel } from "@/shared/lib/attribute-value-translation";
import type { TrainingPlanData } from "../actions/training-plan.action";
import type { UserIntent } from "../model/user-intent";
import type { ExerciseAttributeValueEnum } from "@prisma/client";
import { useCurrentUser } from "@/entities/user/model/useCurrentUser";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GoalSplitSelection } from "@/features/workout-builder/ui/goal-split-selection";
import { deleteTrainingPlan, saveTrainingPlan } from "../actions/training-plan.action";

import { WeeklyAdjustmentCard } from "./weekly-adjustment-card";

interface PlanPageProps {
  plan: TrainingPlanData | null;
}

const INTENT_LABELS: Record<UserIntent, string> = {
  build_strength: "Build Strength",
  build_muscle: "Build Muscle",
  lose_fat: "Lose Fat",
  improve_endurance: "Endurance",
  general_fitness: "Stay Fit",
};

export function PlanPage({ plan }: PlanPageProps) {
  const router = useRouter();

  const handleDelete = async () => {
    await deleteTrainingPlan();
    router.push("/");
    router.refresh();
  };

  const handleStartDay = (dayNumber: number, muscles: ExerciseAttributeValueEnum[]) => {
    sessionStorage.setItem("pendingSplitDay", String(dayNumber));
    sessionStorage.setItem("pendingMuscles", JSON.stringify(muscles));
    router.push("/");
  };

  if (!plan) {
    return <CreatePlanView />;
  }

  return <ActivePlanView plan={plan} onDelete={handleDelete} onStartDay={handleStartDay} />;
}

function CreatePlanView() {
  const router = useRouter();
  const [intent, setIntent] = useState<UserIntent>("general_fitness");
  const [days, setDays] = useState<2 | 3 | 4 | 5 | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();

  const handleSave = async () => {
    if (!days) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveTrainingPlan(intent, days);
      if (!result.success) {
        setError("Please sign in to save your plan.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Create your training plan</h1>
        <p className="text-sm text-slate-500 mt-1">Set your goal and schedule. We&apos;ll generate a science-based split.</p>
      </div>

      {!user && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
            <a href="/auth/signin" className="font-semibold underline">Sign in</a> to save your training plan and track progress.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <AlertDescription className="text-sm text-red-700 dark:text-red-300">{error}</AlertDescription>
        </Alert>
      )}

      <GoalSplitSelection
        selectedIntent={intent}
        selectedDaysPerWeek={days}
        onIntentChange={setIntent}
        onDaysChange={setDays}
        selectedSplitDay={null}
        onSelectSplitDay={() => {}}
      />

      {days && (
        <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-600" size="large">
          <CheckCircle2 className="mr-2 h-5 w-5" />
          {saving ? "Saving..." : "Save plan"}
        </Button>
      )}
    </div>
  );
}

function ActivePlanView({
  plan,
  onDelete,
  onStartDay,
}: {
  plan: TrainingPlanData;
  onDelete: () => void;
  onStartDay: (dayNumber: number, muscles: ExerciseAttributeValueEnum[]) => void;
}) {
  const router = useRouter();
  const t = useI18n();
  const [editing, setEditing] = useState(false);
  const [editIntent, setEditIntent] = useState<UserIntent>(plan.intent);
  const [editDays, setEditDays] = useState<2 | 3 | 4 | 5 | null>(plan.daysPerWeek);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const split = generateSplit(plan.daysPerWeek);
  const goal = intentToTrainingGoalSafe(plan.intent);
  const distributions = distributeVolumeForSplit(split, goal);
  const freqMap = muscleFrequencyInSplit(split);

  const handleSaveEdit = async () => {
    if (!editDays) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveTrainingPlan(editIntent, editDays, { preserveProgress: true });
      if (!result.success) {
        setError("Please sign in to save changes.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <h1 className="text-2xl font-bold">Edit your plan</h1>
        <p className="text-sm text-slate-500">Your progress ({plan.completedSessions} sessions) will be preserved.</p>

        {error && (
          <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
            <AlertDescription className="text-sm text-red-700 dark:text-red-300">{error}</AlertDescription>
          </Alert>
        )}

        <GoalSplitSelection
          selectedIntent={editIntent}
          selectedDaysPerWeek={editDays}
          onIntentChange={setEditIntent}
          onDaysChange={setEditDays}
          selectedSplitDay={null}
          onSelectSplitDay={() => {}}
        />

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            disabled={saving || !editDays}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {/* Weekly smart adjustment */}
      <WeeklyAdjustmentCard tzOffsetMinutes={-new Date().getTimezoneOffset()} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Training Plan</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {INTENT_LABELS[plan.intent]}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {plan.daysPerWeek} days / week
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="small" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="small" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Progress</span>
            <span className="text-sm text-slate-500">{plan.completedSessions} sessions completed</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, (plan.completedSessions % (plan.daysPerWeek * 4)) / (plan.daysPerWeek * 4) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Next recommended: Day {plan.currentDay} · Cycle {Math.floor(plan.completedSessions / split.days.length) + 1}
          </p>
        </CardContent>
      </Card>

      {/* Split days */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Weekly Split</h2>
        {split.days.map((day, idx) => {
          const dist = distributions[idx];
          const isNext = day.dayNumber === plan.currentDay;
          return (
            <Card key={day.dayNumber} className={isNext ? "border-2 border-emerald-500" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                      {day.dayNumber}
                    </span>
                    <span className="font-semibold capitalize">
                      {day.labelKey.split(".").pop()?.replace(/_/g, " ")}
                    </span>
                    {isNext && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Next up
                      </span>
                    )}
                  </div>
                  <Button
                    variant={isNext ? "default" : "outline"}
                    size="small"
                    className={isNext ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                    onClick={() => onStartDay(day.dayNumber, day.muscles)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Train
                  </Button>
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
                        {freq > 1 && <span className="text-emerald-500"> x{freq}</span>}
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function intentToTrainingGoalSafe(intent: UserIntent) {
  const map: Record<UserIntent, "strength" | "hypertrophy" | "endurance" | "general"> = {
    build_strength: "strength",
    build_muscle: "hypertrophy",
    lose_fat: "general",
    improve_endurance: "endurance",
    general_fitness: "general",
  };
  return map[intent];
}
