"use client";

import { useProgressiveOverload } from "../hooks/use-progressive-overload";

const TREND_META: Record<string, { arrow: string; color: string }> = {
  increasing: { arrow: "↑", color: "text-emerald-600 dark:text-emerald-400" },
  plateau: { arrow: "→", color: "text-amber-600 dark:text-amber-400" },
  decreasing: { arrow: "↓", color: "text-red-600 dark:text-red-400" },
  "insufficient-data": { arrow: "—", color: "text-gray-400" },
};

export function ProgressiveOverloadCard({ exerciseId }: { exerciseId: string }) {
  const tzOffsetMinutes = -new Date().getTimezoneOffset();
  const { data, isLoading } = useProgressiveOverload(exerciseId, tzOffsetMinutes);

  if (isLoading) {
    return <div className="rounded-xl border p-4 text-sm text-gray-500">加载渐进超负荷…</div>;
  }

  if (!data) return null;

  const meta = TREND_META[data.trend] ?? TREND_META["insufficient-data"];

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="mb-1 text-sm font-semibold">渐进超负荷</h3>

      <div className="flex items-baseline gap-3">
        <span className={`text-2xl font-bold ${meta.color}`}>{meta.arrow}</span>
        <span className="text-lg font-semibold tabular-nums">{data.lastMaxWeight} kg</span>
        <span className="text-xs text-gray-400">上次 {data.previousMaxWeight} kg</span>
      </div>

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{data.message}</p>
    </div>
  );
}
