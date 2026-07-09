"use client";

import { useState } from "react";
import Image from "next/image";
import { Play, Clock, Repeat } from "lucide-react";
import { useI18n } from "locales/client";

import type { ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";

import { cn } from "@/shared/lib/utils";
import { ExerciseVideoModal } from "@/features/workout-builder/ui/exercise-video-modal";
import { STRETCH_HOLD_SECONDS, WARMUP_REPS, type StretchPhase } from "@/features/training-science/model/stretch-routine";
import { Card, CardContent } from "@/components/ui/card";

interface StretchRoutineSectionProps {
  phase: StretchPhase;
  stretches: ExerciseWithAttributes[];
  completedIds: Set<string>;
  onToggleComplete: (exerciseId: string) => void;
}

const PHASE_CONFIG = {
  warmup: {
    icon: Repeat,
    iconColor: "text-orange-500 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    borderColor: "border-orange-200 dark:border-orange-800",
    accentColor: "bg-orange-100 dark:bg-orange-900",
    metricIcon: Repeat,
    metricValue: `${WARMUP_REPS}`,
  },
  cooldown: {
    icon: Clock,
    iconColor: "text-blue-500 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    accentColor: "bg-blue-100 dark:bg-blue-900",
    metricIcon: Clock,
    metricValue: `${STRETCH_HOLD_SECONDS}s`,
  },
} as const;

export function StretchRoutineSection({ phase, stretches, completedIds, onToggleComplete }: StretchRoutineSectionProps) {
  const t = useI18n();

  if (stretches.length === 0) return null;

  const config = PHASE_CONFIG[phase];
  const PhaseIcon = config.icon;
  const MetricIcon = config.metricIcon;
  const title = phase === "warmup" ? t("workout_builder.session.warmup_title") : t("workout_builder.session.cooldown_title");
  const subtitle = phase === "warmup" ? t("workout_builder.session.warmup_subtitle") : t("workout_builder.session.cooldown_subtitle");
  const metricLabel = phase === "warmup" ? t("workout_builder.session.stretch_reps") : t("workout_builder.session.stretch_hold");

  return (
    <div className={cn("rounded-xl border p-4 mb-6", config.bgColor, config.borderColor)}>
      <div className="flex items-center gap-2 mb-1">
        <PhaseIcon className={cn("h-5 w-5", config.iconColor)} />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{subtitle}</p>
      <div className="space-y-3">
        {stretches.map((exercise) => {
          const isCompleted = completedIds.has(exercise.id);
          const name = exercise.nameEn || exercise.name;
          return (
            <StretchCard
              accentColor={config.accentColor}
              completed={isCompleted}
              exercise={exercise}
              iconColor={config.iconColor}
              key={exercise.id}
              metricIcon={MetricIcon}
              metricLabel={metricLabel}
              metricValue={config.metricValue}
              name={name}
              onToggleComplete={() => onToggleComplete(exercise.id)}
              seeInstructionsLabel={t("workout_builder.session.see_instructions")}
            />
          );
        })}
      </div>
    </div>
  );
}

interface StretchCardProps {
  exercise: ExerciseWithAttributes;
  name: string;
  completed: boolean;
  onToggleComplete: () => void;
  metricIcon: typeof Clock;
  metricLabel: string;
  metricValue: string;
  accentColor: string;
  iconColor: string;
  seeInstructionsLabel: string;
}

function StretchCard({
  exercise,
  name,
  completed,
  onToggleComplete,
  metricIcon: MetricIcon,
  metricLabel,
  metricValue,
  accentColor,
  iconColor,
  seeInstructionsLabel,
}: StretchCardProps) {
  const [videoOpen, setVideoOpen] = useState(false);
  const hasVideo = Boolean(exercise.fullVideoUrl);

  return (
    <Card
      className={cn("cursor-pointer transition-all duration-200 hover:opacity-90", completed && "opacity-60")}
      onClick={onToggleComplete}
    >
      <CardContent className="flex items-center gap-3 p-3">
        {exercise.fullVideoImageUrl ? (
          <div
            className="relative aspect-video max-w-20 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50"
            onClick={(e) => {
              e.stopPropagation();
              if (hasVideo) setVideoOpen(true);
            }}
          >
            <Image alt={name} className="w-full h-full object-cover scale-[1.35]" height={48} src={exercise.fullVideoImageUrl} width={48} />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
              <Play className="h-4 w-4 text-white" />
            </div>
          </div>
        ) : (
          <div className={cn("flex h-12 w-20 shrink-0 items-center justify-center rounded-lg", accentColor)}>
            <MetricIcon className={cn("h-5 w-5", iconColor)} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-semibold truncate", completed ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200")}>
              {name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <MetricIcon className="h-3 w-3" />
              {metricValue} · {metricLabel}
            </span>
            {hasVideo && (
              <span
                className="text-xs text-slate-400 underline cursor-pointer hover:text-blue-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoOpen(true);
                }}
              >
                {seeInstructionsLabel}
              </span>
            )}
          </div>
        </div>
        <button
          aria-label="Toggle complete"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90",
            completed ? "border-green-500 bg-green-500" : "border-slate-300 dark:border-slate-600 hover:border-slate-400",
          )}
        >
          {completed && <span className="text-white text-xs">✓</span>}
        </button>
      </CardContent>
      {hasVideo && <ExerciseVideoModal exercise={exercise} onOpenChange={setVideoOpen} open={videoOpen} />}
    </Card>
  );
}
