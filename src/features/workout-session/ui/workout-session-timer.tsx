"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { ensureAudioContext, playTone, vibrate } from "@/shared/lib/audio-feedback";
import { brandedToast } from "@/components/ui/toast";
import { useI18n } from "locales/client";
import { useWorkoutSession } from "@/features/workout-builder";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/ui/timer";

export function WorkoutSessionTimer() {
  const t = useI18n();
  const {
    session,
    isWorkoutActive,
    isTimerRunning,
    sessionPrescription,
    toggleTimer,
    resetTimer,
    elapsedTime,
    setElapsedTime,
    setTargetDurationSeconds: setSessionTargetDurationSeconds,
  } = useWorkoutSession();

  const [elapsedSeconds, setElapsedSeconds] = useState(elapsedTime);
  const [resetCount, setResetCount] = useState(0);
  const [targetDurationSeconds, setTargetDurationSeconds] = useState<number | null>(
    sessionPrescription?.targetDurationSeconds ?? null,
  );
  const initialTargetDurationRef = useRef<number | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastFeedback = useRef<"none" | "warning" | "critical" | "overtime">("none");

  useEffect(() => {
    setElapsedSeconds(elapsedTime);
  }, [elapsedTime]);

  useEffect(() => {
    const nextTarget = sessionPrescription?.targetDurationSeconds ?? null;
    setTargetDurationSeconds(nextTarget);

    const nextSessionId = session?.id ?? null;
    if (!nextSessionId) {
      initialTargetDurationRef.current = null;
      activeSessionIdRef.current = null;
      return;
    }

    if (activeSessionIdRef.current !== nextSessionId) {
      activeSessionIdRef.current = nextSessionId;
      initialTargetDurationRef.current = nextTarget && nextTarget > 0 ? nextTarget : null;
    }
  }, [session?.id, sessionPrescription?.targetDurationSeconds]);

  const effectiveTargetSeconds = targetDurationSeconds ?? sessionPrescription?.targetDurationSeconds ?? null;
  const hasTarget = effectiveTargetSeconds !== null && effectiveTargetSeconds > 0;
  const recommendedTargetSeconds = effectiveTargetSeconds !== null && initialTargetDurationRef.current !== null
    ? initialTargetDurationRef.current
    : effectiveTargetSeconds;

  const formatClock = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const remainingSeconds = effectiveTargetSeconds ? Math.max(effectiveTargetSeconds - elapsedSeconds, 0) : null;
  const overtimeSeconds = effectiveTargetSeconds
    ? Math.max(elapsedSeconds - effectiveTargetSeconds, 0)
    : 0;
  const progressPercent = effectiveTargetSeconds
    ? Math.min(Math.round((Math.min(elapsedSeconds, effectiveTargetSeconds) / effectiveTargetSeconds) * 100), 100)
    : 0;

  const urgencyLevel = effectiveTargetSeconds
    ? remainingSeconds === null
      ? 1
      : remainingSeconds / effectiveTargetSeconds
    : 1;

  const isOvertime = effectiveTargetSeconds !== null && elapsedSeconds > effectiveTargetSeconds;
  const isCritical = effectiveTargetSeconds !== null && urgencyLevel <= 0.1;
  const isWarning = effectiveTargetSeconds !== null && urgencyLevel <= 0.25 && urgencyLevel > 0.1;

  const tone = isOvertime
    ? {
      value: "text-rose-700 dark:text-rose-200",
      container: "border-rose-300 dark:border-rose-700 bg-rose-50/80 dark:bg-rose-900/25",
      button: "bg-rose-500 hover:bg-rose-600",
      bar: "bg-rose-500",
      pulse: "animate-pulse",
    }
    : isCritical
      ? {
        value: "text-amber-700 dark:text-amber-200",
        container: "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/25",
        button: "bg-amber-500 hover:bg-amber-600",
        bar: "bg-amber-500",
        pulse: "",
      }
      : isWarning
        ? {
          value: "text-yellow-700 dark:text-yellow-200",
          container: "border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/25",
          button: "bg-yellow-500 hover:bg-yellow-600",
          bar: "bg-yellow-500",
          pulse: "",
        }
        : {
          value: "text-slate-700 dark:text-slate-200",
          container: "border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900",
          button: "bg-emerald-500 hover:bg-emerald-600",
          bar: "bg-emerald-500",
          pulse: "",
        };
  const currentTargetMinutes = Math.max(5, Math.round((effectiveTargetSeconds || 0) / 60));
  const canDecreaseTarget = currentTargetMinutes > 5;
  const canIncreaseTarget = currentTargetMinutes < 120;

  const announceTargetDuration = (seconds: number) => {
    const subtitle = formatClock(seconds);
    brandedToast({
      title: `${t("workout_builder.session.target_duration_label")}: ${subtitle}`,
      subtitle: t("workout_builder.session.target_duration_label"),
      variant: "success",
    });
  };

  const playFeedback = (kind: "warning" | "critical" | "overtime") => {
    const ctx = ensureAudioContext(audioContextRef);
    if (!ctx) return;

    if (kind === "warning") {
      playTone(ctx, 900, 0.06, "sine", 0.08);
      vibrate([8, 5, 8]);
      return;
    }

    if (kind === "critical") {
      playTone(ctx, 700, 0.08, "sine", 0.09);
      vibrate([10, 6, 10]);
      return;
    }

    playTone(ctx, 1200, 0.12, "triangle", 0.12);
    setTimeout(() => playTone(ctx, 900, 0.12, "triangle", 0.1), 120);
    vibrate([18, 10, 20]);
  };

  useEffect(() => {
    if (!effectiveTargetSeconds || !hasTarget) {
      lastFeedback.current = "none";
      return;
    }

    if (!isTimerRunning) {
      return;
    }

    if (isOvertime) {
      if (lastFeedback.current !== "overtime") {
        playFeedback("overtime");
        lastFeedback.current = "overtime";
      }
      return;
    }

    if (isCritical) {
      if (lastFeedback.current !== "critical") {
        playFeedback("critical");
        lastFeedback.current = "critical";
      }
      return;
    }

    if (isWarning) {
      if (lastFeedback.current === "none") {
        playFeedback("warning");
        lastFeedback.current = "warning";
      }
      return;
    }

    if (urgencyLevel > 0.25) {
      lastFeedback.current = "none";
    }
  }, [effectiveTargetSeconds, isCritical, isOvertime, isWarning, isTimerRunning, hasTarget, urgencyLevel]);

  const handleReset = () => {
    resetTimer();
    setElapsedSeconds(0);
    setElapsedTime(0);
    setResetCount((c) => c + 1);
  };

  const updateTargetDuration = (seconds: number, announce = true) => {
    const next = Math.max(5 * 60, Math.round(seconds));
    if (next === targetDurationSeconds) return;

    setTargetDurationSeconds(next);
    setSessionTargetDurationSeconds(next);
    if (announce) {
      announceTargetDuration(next);
    }
  };

  const updateTargetDurationMinutes = (minutes: number, announce = true) => {
    updateTargetDuration(Math.max(5, Math.min(120, Math.round(minutes))) * 60, announce);
  };

  const adjustTarget = (minutesDelta: number) => {
    const current = targetDurationSeconds ?? effectiveTargetSeconds ?? 0;
    updateTargetDuration(current + minutesDelta * 60);
  };

  const activePresetTargetClass =
    "border-transparent bg-slate-900 text-white dark:bg-white dark:text-slate-900";

  const restoreRecommendedTarget = () => {
    if (recommendedTargetSeconds !== null) {
      updateTargetDuration(recommendedTargetSeconds);
    }
  };

  const targetProgressLabel = isOvertime
    ? t("workout_builder.session.target_time_exceeded", {
      time: formatClock(overtimeSeconds),
    })
    : t("workout_builder.session.remaining_time", {
      time: formatClock(remainingSeconds || 0),
    });

  if (!isWorkoutActive) {
    return null;
  }

  return (
    <div className="fixed bottom-36 sm:bottom-20 left-1/2 transform -translate-x-1/2 mb-3 z-50">
    <div className="fixed left-1/2 top-auto z-[60] mb-3 w-[95vw] max-w-[28rem] transform -translate-x-1/2 bottom-[calc(8rem+env(safe-area-inset-bottom))] sm:bottom-24">
      <div
        className={cn(
          "rounded-full border px-4 py-3 shadow-lg backdrop-blur-sm transition-colors duration-300",
          tone.container,
          tone.pulse,
          "max-w-[92vw] sm:max-w-none",
        )}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0" aria-live="polite">
            <div className="flex items-center gap-3">
              <div className={cn("text-xl font-mono font-bold tracking-wider", tone.value)}>
                <Timer
                  initialSeconds={elapsedTime}
                  isRunning={isTimerRunning}
                  key={resetCount}
                  onChange={(seconds) => {
                    setElapsedSeconds(seconds);
                    setElapsedTime(seconds);
                  }}
                />
              </div>
              {hasTarget ? (
                <div className={cn("text-xs", tone.value)}>
                  <div>{t("workout_builder.session.target_duration_label")}</div>
                  <div className="font-mono font-bold">{formatClock(effectiveTargetSeconds)}</div>
                </div>
              ) : null}
            </div>

            {effectiveTargetSeconds ? (
              <>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/70 overflow-hidden">
                  <div className={cn("h-full transition-all duration-500", tone.bar)} style={{ width: `${progressPercent}%` }} />
                </div>

                <div className={cn("mt-2 text-xs", tone.value)}>
                  {targetProgressLabel}
                  <span className="ml-2 font-semibold">
                    {progressPercent}% {t("workout_builder.session.progress")}
                  </span>
                </div>

                <div className="mt-2 rounded-md border border-slate-200/70 bg-white/60 p-2 dark:border-slate-500/40 dark:bg-slate-900/35">
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="h-3 w-3 opacity-70" />
                      <span>{t("workout_builder.session.target_duration_label")}</span>
                    </div>
                    <button
                      className={cn(
                        "rounded-full border px-2 py-1 transition-colors",
                        effectiveTargetSeconds === recommendedTargetSeconds
                          ? activePresetTargetClass
                          : "border-cyan-300/80 bg-cyan-50 text-cyan-700 dark:border-cyan-700/60 dark:bg-cyan-900/40 dark:text-cyan-200",
                      )}
                      onClick={restoreRecommendedTarget}
                      type="button"
                      aria-label={`Restore ${t("workout_builder.session.target_duration_label")} ${formatClock(
                        recommendedTargetSeconds || effectiveTargetSeconds || 0,
                      )}`}
                    >
                      {formatClock(recommendedTargetSeconds || effectiveTargetSeconds || 0)}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1">
                  <Button
                    className={cn("h-7 px-1 rounded-full text-xs", tone.button)}
                    onClick={() => adjustTarget(-5)}
                    variant="default"
                    type="button"
                    disabled={!canDecreaseTarget}
                    aria-label={`${t("workout_builder.session.target_duration_label")} -5${t("workout_builder.session.time_unit_min")}`}
                  >
                    -5
                  </Button>
                  <Button
                    className={cn("h-7 px-2 rounded-full text-xs", tone.button)}
                    onClick={() => adjustTarget(-1)}
                    variant="default"
                    type="button"
                    disabled={!canDecreaseTarget}
                    aria-label={`${t("workout_builder.session.target_duration_label")} -1${t("workout_builder.session.time_unit_min")}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Button
                    className={cn("h-7 px-2 rounded-full text-xs", tone.button)}
                    onClick={() => adjustTarget(1)}
                    variant="default"
                    type="button"
                    disabled={!canIncreaseTarget}
                    aria-label={`${t("workout_builder.session.target_duration_label")} +1${t("workout_builder.session.time_unit_min")}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    className={cn("h-7 px-1 rounded-full text-xs", tone.button)}
                    onClick={() => adjustTarget(5)}
                    variant="default"
                    type="button"
                    disabled={!canIncreaseTarget}
                    aria-label={`${t("workout_builder.session.target_duration_label")} +5${t("workout_builder.session.time_unit_min")}`}
                  >
                    +5
                  </Button>
                  <Button
                    className={cn("h-7 px-1 rounded-full text-[11px]", tone.button)}
                    onClick={() => adjustTarget(-10)}
                    variant="default"
                    type="button"
                    disabled={!canDecreaseTarget || currentTargetMinutes <= 10}
                    aria-label={`${t("workout_builder.session.target_duration_label")} -10${t("workout_builder.session.time_unit_min")}`}
                  >
                    -10
                  </Button>
                  <Button
                    className={cn("h-7 px-1 rounded-full text-[11px]", tone.button)}
                    onClick={() => adjustTarget(10)}
                    variant="default"
                    type="button"
                    disabled={!canIncreaseTarget || currentTargetMinutes >= 110}
                    aria-label={`${t("workout_builder.session.target_duration_label")} +10${t("workout_builder.session.time_unit_min")}`}
                  >
                    +10
                  </Button>
                  <span className={cn("text-[11px] px-1", tone.value)}>
                    {currentTargetMinutes}{t("workout_builder.session.time_unit_min")}
                  </span>
                </div>
                <div className="mt-2 px-1">
                  <div className="text-[11px] text-slate-500 dark:text-slate-300">
                    {t("workout_builder.session.target_duration_label")}: {formatClock(
                      recommendedTargetSeconds || effectiveTargetSeconds || 0,
                    )}
                  </div>
                </div>
              </>
            ) : null}

          </div>

          <div className="flex items-center gap-3">
            <Button
              className={cn(
                "w-12 h-12 rounded-full p-0 text-white shadow-md",
                tone.button,
              )}
              onClick={toggleTimer}
              aria-label={isTimerRunning ? "Pause workout" : "Start workout"}
            >
              {isTimerRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            <Button
              className={cn(
                "w-12 h-12 rounded-full p-0 border-slate-200 text-slate-400 shadow-md",
                "hover:bg-slate-200 dark:border-slate-600 hover:dark:bg-slate-700",
              )}
              onClick={handleReset}
              variant="outline"
              aria-label="Reset workout timer"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
