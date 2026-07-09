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

const INTENT_LABEL_KEYS: Record<UserIntent, string> = {
  build_strength: "workout_builder.goal_strength",
  build_muscle: "workout_builder.goal_hypertrophy",
  lose_fat: "workout_builder.goal_endurance",
  improve_endurance: "workout_builder.goal_endurance",
  general_fitness: "workout_builder.goal_general",
};

const SPLIT_LABEL_KEYS: Record<string, string> = {
  "training_science.split.fullbody_a": "workout_builder.split_fullbody_1",
  "training_science.split.fullbody_b": "workout_builder.split_fullbody_2",
  "training_science.split.push": "workout_builder.split_ppl_1",
  "training_science.split.pull": "workout_builder.split_ppl_2",
  "training_science.split.legs": "workout_builder.split_ppl_3",
  "training_science.split.upper_a": "workout_builder.split_upperlower_1",
  "training_science.split.lower_a": "workout_builder.split_upperlower_2",
  "training_science.split.upper_b": "workout_builder.split_upperlower_3",
  "training_science.split.lower_b": "workout_builder.split_upperlower_4",
  "training_science.split.upper": "workout_builder.split_ppl-ul_4",
  "training_science.split.lower_core": "workout_builder.split_ppl-ul_5",
};

const getSplitLabel = (t: ReturnType<typeof useI18n>, labelKey: string) => {
  const translatedKey = SPLIT_LABEL_KEYS[labelKey];
  return t((translatedKey ?? (labelKey as keyof typeof t)) as keyof typeof t);
};

const getIntentLabel = (t: ReturnType<typeof useI18n>, intent: UserIntent) => {
  return t(INTENT_LABEL_KEYS[intent] as keyof typeof t);
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
  const t = useI18n();
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
        setError(t("workout_builder.plan_page.save_error_auth"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("workout_builder.plan_page.save_error_generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("workout_builder.plan_page.create_title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("workout_builder.plan_page.create_subtitle")}</p>
      </div>

      {!user && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
            <a href="/auth/signin" className="font-semibold underline">
              {t("commons.login")}
            </a>{" "}
            {t("workout_builder.plan_page.sign_in_prompt_suffix")}
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
          {saving ? t("commons.saving") : t("workout_builder.plan_page.save_plan")}
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
        setError(t("workout_builder.plan_page.save_error_auth"));
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError(t("workout_builder.plan_page.save_error_generic"));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <h1 className="text-2xl font-bold">{t("workout_builder.plan_page.edit_title")}</h1>
        <p className="text-sm text-slate-500">
          {t("workout_builder.plan_page.preserve_progress", { sessions: plan.completedSessions })}
        </p>

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
            {t("commons.cancel")}
          </Button>
          <Button
            onClick={handleSaveEdit}
            disabled={saving || !editDays}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {saving ? t("commons.saving") : t("workout_builder.plan_page.save_changes")}
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
          <h1 className="text-2xl font-bold">{t("workout_builder.plan_page.my_plan_title")}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {getIntentLabel(t, plan.intent)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {t("workout_builder.plan_page.days_per_week", { days: plan.daysPerWeek })}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="small" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            {t("commons.edit")}
          </Button>
          <Button variant="outline" size="small" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            {t("commons.delete")}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{t("workout_builder.plan_page.progress_title")}</span>
            <span className="text-sm text-slate-500">
              {t("workout_builder.plan_page.progress_sessions", { count: plan.completedSessions })}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, (plan.completedSessions % (plan.daysPerWeek * 4)) / (plan.daysPerWeek * 4) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {t("workout_builder.plan_page.next_recommended", {
              day: plan.currentDay,
              cycle: Math.floor(plan.completedSessions / split.days.length) + 1,
            })}
          </p>
        </CardContent>
      </Card>

      {/* Split days */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("workout_builder.plan_page.weekly_split_title")}</h2>
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
                      {getSplitLabel(t, day.labelKey)}
                    </span>
                    {isNext && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {t("workout_builder.plan_page.next_up")}
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
                    {t("workout_builder.plan_page.train_button")}
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
