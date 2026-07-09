"use client";

import { useEffect, useMemo, useRef } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

import { useWorkoutSession } from "@/features/workout-builder";
import { useI18n } from "locales/client";
import { brandedToast } from "@/components/ui/toast";
import { ensureAudioContext, playTone, vibrate } from "@/shared/lib/audio-feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";

export function RestTimer() {
  const { restSeconds, isRestActive, stopRest, tickRest, adjustRest, sessionPrescription } = useWorkoutSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedSecondsRef = useRef(0);
  const pendingRestSecondsRef = useRef<number | null>(null);
  const lastHapticSecondRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wasRestActiveRef = useRef(false);
  const t = useI18n();
  const recommendedRestSeconds = sessionPrescription?.restIntervalSeconds ?? 30;
  const quickRestSeconds = useMemo(() => {
    const candidates = [
      Math.max(5, recommendedRestSeconds - 30),
      Math.max(5, recommendedRestSeconds - 20),
      Math.max(5, recommendedRestSeconds - 10),
      recommendedRestSeconds,
      recommendedRestSeconds + 10,
      recommendedRestSeconds + 20,
      recommendedRestSeconds + 30,
      90,
    ];
    return Array.from(new Set(candidates))
      .filter((seconds) => seconds >= 5 && seconds <= 180)
      .sort((a, b) => a - b);
  }, [recommendedRestSeconds]);

  useEffect(() => {
    if (isRestActive && !wasRestActiveRef.current && restSeconds > 0) {
      startedSecondsRef.current = restSeconds;
      wasRestActiveRef.current = true;
    }
  }, [isRestActive, restSeconds]);

  useEffect(() => {
    if (!isRestActive || restSeconds <= 0) return;
    intervalRef.current = setInterval(() => {
      tickRest();
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRestActive, tickRest]);

  useEffect(() => {
    if (!isRestActive) {
      lastHapticSecondRef.current = null;
      wasRestActiveRef.current = false;
      return;
    }

    if (restSeconds <= 0) {
      return;
    }

    if (restSeconds <= 5 && lastHapticSecondRef.current !== restSeconds) {
      const ctx = ensureAudioContext(audioContextRef);
      if (ctx) {
        const isFinal = restSeconds <= 1;
        playTone(ctx, isFinal ? 700 : 400, 0.06, isFinal ? "triangle" : "sine", isFinal ? 0.12 : 0.08);
      }
      if (restSeconds <= 2) {
        vibrate([4, 6, 4]);
      } else {
        vibrate([6]);
      }
      lastHapticSecondRef.current = restSeconds;
    }
  }, [isRestActive, restSeconds]);

  const totalRestSeconds = Math.max(startedSecondsRef.current, restSeconds);
  const restProgress = totalRestSeconds > 0 ? Math.max(0, Math.min((restSeconds / totalRestSeconds) * 100, 100)) : 0;

  const announceRestSeconds = (seconds: number) => {
    brandedToast({
      title: `${t("workout_builder.session.prescription_rest_label")}: ${seconds}${t("workout_builder.session.time_unit_seconds")}`,
      subtitle: t("workout_builder.session.rest_label"),
      variant: "info",
    });
  };

  const setRestSeconds = (seconds: number, shouldAnnounce = true, shouldBuzz = true) => {
    if (seconds <= 0) return;
    if (seconds === restSeconds) return;
    adjustRest(seconds - restSeconds);
    if (seconds > startedSecondsRef.current) {
      startedSecondsRef.current = seconds;
    }
    if (shouldBuzz) {
      const ctx = ensureAudioContext(audioContextRef);
      if (ctx) {
        playTone(ctx, 520, 0.04, "sine", 0.07);
      }
      vibrate(3);
    }
    if (shouldAnnounce) {
      announceRestSeconds(seconds);
    }
  };

  const commitRestDurationFromSlider = () => {
    const pending = pendingRestSecondsRef.current;
    if (pending === null) return;
    pendingRestSecondsRef.current = null;
    setRestSeconds(pending, true, false);
  };

  const adjustRestSeconds = (delta: number) => {
    const next = Math.max(0, restSeconds + delta);
    if (next === restSeconds) return;
    if (next > 0) {
      startedSecondsRef.current = Math.max(startedSecondsRef.current, next);
    }
    adjustRest(delta);
    const ctx = ensureAudioContext(audioContextRef);
    if (ctx) {
      playTone(ctx, 520, 0.04, "sine", 0.07);
    }
    vibrate(3);
    if (next > 0) {
      announceRestSeconds(next);
    }
  };

  if (!isRestActive || restSeconds <= 0) return null;

  return (
    <div
      className="fixed bottom-44 sm:bottom-28 left-1/2 transform -translate-x-1/2 z-50
      animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="relative flex items-center gap-3 rounded-full bg-blue-500 px-6 py-3 text-white shadow-lg">
        <div className="text-center">
          <div className="text-xs font-medium opacity-80">{t("workout_builder.session.rest_label")}</div>
          <div className="text-2xl font-mono font-bold tabular-nums">
            {t("workout_builder.session.rest_countdown", { seconds: restSeconds })}
          </div>
          <div className="mt-2 h-1.5 w-40 max-w-[50vw] rounded-full bg-blue-200/80 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 bg-white",
                restProgress < 25 ? "bg-rose-200" : "bg-white",
              )}
              style={{ width: `${restProgress}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] opacity-80">
            {t("workout_builder.session.prescription_rest_label")}：{recommendedRestSeconds}{t("workout_builder.session.time_unit_seconds")}
          </div>
        </div>
        <button
          onClick={stopRest}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          aria-label={t("workout_builder.session.skip_rest")}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Button
            className="h-8 w-8 rounded-full border border-white/40 text-white bg-white/20 hover:bg-white/30"
            onClick={() => {
              setRestSeconds(recommendedRestSeconds);
            }}
            size="icon"
            type="button"
            variant="outline"
            aria-label="Reset rest to recommended seconds"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            className="h-8 w-8 rounded-full border border-white/40 text-white bg-white/20 hover:bg-white/30"
            onClick={() => {
              adjustRestSeconds(-5);
            }}
            size="icon"
            type="button"
            variant="outline"
            aria-label="Decrease rest by 5 seconds"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            className="h-8 w-8 rounded-full border border-white/40 text-white bg-white/20 hover:bg-white/30"
            onClick={() => {
              adjustRestSeconds(5);
            }}
            size="icon"
            type="button"
            variant="outline"
            aria-label="Increase rest by 5 seconds"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 px-1 w-full max-w-[60vw]">
          <div className="mb-1 text-[11px] text-center opacity-80">
            {restSeconds}
            {t("workout_builder.session.time_unit_seconds")}
          </div>
          <input
            aria-label={t("workout_builder.session.prescription_rest_label")}
            className="h-2 w-full cursor-pointer accent-blue-200"
            max={180}
            min={5}
            onBlur={commitRestDurationFromSlider}
            onChange={(event) => {
              pendingRestSecondsRef.current = Number(event.target.value);
              setRestSeconds(Number(event.target.value), false, false);
            }}
            onKeyUp={commitRestDurationFromSlider}
            onMouseUp={commitRestDurationFromSlider}
            onPointerUp={commitRestDurationFromSlider}
            onPointerDown={() => {
              pendingRestSecondsRef.current = Math.max(
                5,
                Math.min(180, restSeconds),
              );
            }}
            onTouchEnd={commitRestDurationFromSlider}
            step={5}
            type="range"
            value={Math.max(5, Math.min(180, restSeconds))}
          />
        </div>
        <div className="absolute left-1/2 top-full mt-1 flex flex-wrap justify-center gap-1 max-w-[60vw] -translate-x-1/2">
          {quickRestSeconds.map((seconds) => (
            <button
              className={cn(
                "rounded-full border border-white/40 px-2 py-1 text-[11px] transition-colors",
                seconds === restSeconds
                  ? "bg-white text-blue-700 dark:text-blue-900"
                  : "bg-blue-400/20 text-white hover:bg-white/20",
              )}
              key={seconds}
              onClick={() => setRestSeconds(seconds)}
              type="button"
            >
              {seconds}
              {t("workout_builder.session.time_unit_seconds")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
