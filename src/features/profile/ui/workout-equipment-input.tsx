"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Dumbbell, Home, MonitorSmartphone } from "lucide-react";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { EQUIPMENT_CONFIG } from "@/features/workout-builder/model/equipment-config";
import {
  normalizeWorkoutPreferences,
  type ResolvedWorkoutPreferences,
  type EquipmentMode,
  type WorkoutEnvironment,
} from "@/shared/lib/user-preferences";
import { Button } from "@/components/ui/button";

interface WorkoutPreferences extends ResolvedWorkoutPreferences {}

const WORKOUT_PREFERENCES_KEY = ["user-workout-preferences"];

async function fetchWorkoutPreferences(): Promise<WorkoutPreferences> {
  const res = await fetch("/api/user/preferences", { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch preferences");
  }
  const data = await res.json();
  return normalizeWorkoutPreferences(data?.preferences ?? {});
}

export function WorkoutEquipmentInput() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: WORKOUT_PREFERENCES_KEY,
    queryFn: fetchWorkoutPreferences,
    staleTime: 5 * 60 * 1000,
  });
  const [equipmentMode, setEquipmentMode] = useState<EquipmentMode>("all");
  const [workoutEnvironment, setWorkoutEnvironment] = useState<WorkoutEnvironment>("office");
  const [availableEquipment, setAvailableEquipment] = useState<ExerciseAttributeValueEnum[]>([]);
  const [quickTimeBudget, setQuickTimeBudget] = useState(10);
  const [planSessionMinutes, setPlanSessionMinutes] = useState(30);
  const [restIntervalSeconds, setRestIntervalSeconds] = useState(30);
  const [warmupRoutineEnabled, setWarmupRoutineEnabled] = useState(true);
  const [warmupExerciseCount, setWarmupExerciseCount] = useState(3);
  const [warmupReps, setWarmupReps] = useState(10);
  const [cooldownRoutineEnabled, setCooldownRoutineEnabled] = useState(true);
  const [cooldownExerciseCount, setCooldownExerciseCount] = useState(2);
  const [cooldownHoldSeconds, setCooldownHoldSeconds] = useState(30);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!data) return;
    setEquipmentMode(data.equipmentMode);
    setWorkoutEnvironment(data.workoutEnvironment);
    setAvailableEquipment(data.availableEquipment);
    setQuickTimeBudget(data.prescription.quickTimeBudget);
    setPlanSessionMinutes(data.prescription.planSessionMinutes);
    setRestIntervalSeconds(data.prescription.restIntervalSeconds);
    setWarmupRoutineEnabled(data.prescription.warmupRoutineEnabled);
    setWarmupExerciseCount(data.prescription.warmupExerciseCount);
    setWarmupReps(data.prescription.warmupReps);
    setCooldownRoutineEnabled(data.prescription.cooldownRoutineEnabled);
    setCooldownExerciseCount(data.prescription.cooldownExerciseCount);
    setCooldownHoldSeconds(data.prescription.cooldownHoldSeconds);
  }, [data]);

  const isCustomMode = equipmentMode === "custom";
  const canSave = !saving && !isLoading && (!isCustomMode || availableEquipment.length > 0);

  const toggleEquipment = (value: ExerciseAttributeValueEnum) => {
    setAvailableEquipment((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const handleSave = async () => {
    setError("");
    setMessage("");

    if (!isCustomMode && equipmentMode !== "bodyweight_only" && equipmentMode !== "all") {
      setError("未知的模式");
      return;
    }

    if (isCustomMode && availableEquipment.length === 0) {
      setError("请至少选择一个可用器械");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/user/preferences", {
        credentials: "include",
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentMode,
          availableEquipment,
          workoutEnvironment,
          quickTimeBudget,
          planSessionMinutes,
          restIntervalSeconds,
          warmupRoutineEnabled,
          warmupExerciseCount,
          warmupReps,
          cooldownRoutineEnabled,
          cooldownExerciseCount,
          cooldownHoldSeconds,
        }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      await queryClient.invalidateQueries({ queryKey: WORKOUT_PREFERENCES_KEY });
      setMessage("偏好已保存");
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-base-100 border border-base-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-5 w-5 text-base-content/60" />
        <span className="font-medium text-base-content/80">训练偏好</span>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-base-content/70">器械模式</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2">
            <input
              checked={equipmentMode === "all"}
              disabled={saving}
              name="equipment-mode"
              onChange={() => setEquipmentMode("all")}
              type="radio"
            />
            全部可选
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              checked={equipmentMode === "bodyweight_only"}
              disabled={saving}
              name="equipment-mode"
              onChange={() => setEquipmentMode("bodyweight_only")}
              type="radio"
            />
            纯自重
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              checked={isCustomMode}
              disabled={saving}
              name="equipment-mode"
              onChange={() => setEquipmentMode("custom")}
              type="radio"
            />
            自定义
          </label>
        </div>
      </div>

      {isCustomMode && (
        <div className="space-y-2">
          <p className="text-sm text-base-content/70">可用器械（自定义）</p>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_CONFIG.map((equipment) => (
              <label
                className="inline-flex items-center gap-2 rounded-full border border-base-300 px-3 py-2 text-sm"
                key={equipment.value}
              >
                <input
                  checked={availableEquipment.includes(equipment.value)}
                  disabled={saving}
                  onChange={() => toggleEquipment(equipment.value)}
                  type="checkbox"
                />
                {equipment.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-base-content/70">训练环境</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2">
            <input
              checked={workoutEnvironment === "office"}
              disabled={saving}
              name="workout-environment"
              onChange={() => setWorkoutEnvironment("office")}
              type="radio"
            />
            <MonitorSmartphone className="h-4 w-4" />
            办公模式
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              checked={workoutEnvironment === "unrestricted"}
              disabled={saving}
              name="workout-environment"
              onChange={() => setWorkoutEnvironment("unrestricted")}
              type="radio"
            />
            <Home className="h-4 w-4" />
            家/健身房
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-base-content/70">快捷训练时长（分钟）</p>
        <div className="flex flex-wrap gap-2">
          {([5, 10, 15, 20, 25] as const).map((item) => (
            <label className="inline-flex items-center gap-2 rounded-full border border-base-300 px-3 py-2 text-sm" key={`quick-time-${item}`}>
              <input
                checked={quickTimeBudget === item}
                disabled={saving}
                onChange={() => setQuickTimeBudget(item)}
                type="radio"
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-base-content/70">计划日建议时长（分钟）</p>
        <div className="flex flex-wrap gap-2">
          {([20, 30, 40, 50] as const).map((item) => (
            <label className="inline-flex items-center gap-2 rounded-full border border-base-300 px-3 py-2 text-sm" key={`plan-time-${item}`}>
              <input
                checked={planSessionMinutes === item}
                disabled={saving}
                onChange={() => setPlanSessionMinutes(item)}
                type="radio"
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-base-content/70">每组间歇（秒）</p>
        <div className="flex flex-wrap gap-2">
          {([5, 10, 15, 20, 25, 30, 40, 45, 50, 60] as const).map((item) => (
            <label className="inline-flex items-center gap-2 rounded-full border border-base-300 px-3 py-2 text-sm" key={`rest-${item}`}>
              <input
                checked={restIntervalSeconds === item}
                disabled={saving}
                onChange={() => setRestIntervalSeconds(item)}
                type="radio"
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-base-content/70">热身动作（开关/数量/每动作次数）</p>
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2">
            <input
              checked={warmupRoutineEnabled}
              disabled={saving}
              onChange={(event) => setWarmupRoutineEnabled(event.target.checked)}
              type="checkbox"
            />
            开启热身
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((item) => (
              <label className="inline-flex items-center gap-2" key={`warmup-count-${item}`}>
                <input
                  checked={warmupExerciseCount === item}
                  disabled={saving}
                  name="warmupCount"
                  onChange={() => setWarmupExerciseCount(item)}
                  type="radio"
                />
                {item} 个
              </label>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[6, 8, 10, 12, 14, 15].map((item) => (
              <label className="inline-flex items-center gap-2" key={`warmup-reps-${item}`}>
                <input
                  checked={warmupReps === item}
                  disabled={saving}
                  name="warmupReps"
                  onChange={() => setWarmupReps(item)}
                  type="radio"
                />
                {item} 次
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-base-content/70">放松动作（开关/数量/停留秒）</p>
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2">
            <input
              checked={cooldownRoutineEnabled}
              disabled={saving}
              onChange={(event) => setCooldownRoutineEnabled(event.target.checked)}
              type="checkbox"
            />
            开启放松
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((item) => (
              <label className="inline-flex items-center gap-2" key={`cooldown-count-${item}`}>
                <input
                  checked={cooldownExerciseCount === item}
                  disabled={saving}
                  name="cooldownCount"
                  onChange={() => setCooldownExerciseCount(item)}
                  type="radio"
                />
                {item} 个
              </label>
              ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[20, 25, 30, 35, 40].map((item) => (
              <label className="inline-flex items-center gap-2" key={`cooldown-hold-${item}`}>
                <input
                  checked={cooldownHoldSeconds === item}
                  disabled={saving}
                  name="cooldownHold"
                  onChange={() => setCooldownHoldSeconds(item)}
                  type="radio"
                />
                {item} 秒
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={!canSave} onClick={handleSave} size="small" variant="default">
          {saving ? "..." : "保存偏好"}
        </Button>
        {error && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <CircleAlert className="h-4 w-4" />
            {error}
          </span>
        )}
        {message && !error && <span className="text-sm text-green-600">{message}</span>}
      </div>
    </div>
  );
}
