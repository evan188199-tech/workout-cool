"use client";

import { useACWR } from "../hooks/use-acwr";

const ZONE_STYLES: Record<string, { bar: string; text: string; label: string }> = {
  green: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "最佳区间" },
  yellow: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "警戒" },
  red: { bar: "bg-red-500", text: "text-red-600 dark:text-red-400", label: "危险" },
  undertrained: { bar: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", label: "训练量偏低" },
  "insufficient-data": { bar: "bg-gray-400", text: "text-gray-500", label: "数据不足" },
};

export function ACWRGauge() {
  const tzOffsetMinutes = -new Date().getTimezoneOffset();
  const { data, isLoading } = useACWR(tzOffsetMinutes);

  if (isLoading) {
    return <div className="rounded-xl border p-4 text-sm text-gray-500">加载急慢性负荷比…</div>;
  }

  const ratio = data?.ratio ?? null;
  const zone = data?.zone ?? "insufficient-data";
  const style = ZONE_STYLES[zone] ?? ZONE_STYLES["insufficient-data"];

  // Map ratio onto a 0..1.8 visual scale (0..100%).
  const pct = ratio !== null ? Math.min(Math.max(ratio / 1.8, 0), 1) * 100 : 0;

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">急慢性负荷比 ACWR</h3>
        <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
      </div>

      {/* Track with zone bands */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        {/* zone bands: <0.8 sky, 0.8-1.3 green, 1.3-1.5 amber, >1.5 red */}
        <div className="absolute inset-y-0 left-0 w-[44%] bg-sky-200 dark:bg-sky-900/50" />
        <div className="absolute inset-y-0 left-[44%] w-[28%] bg-emerald-200 dark:bg-emerald-900/50" />
        <div className="absolute inset-y-0 left-[72%] w-[11%] bg-amber-200 dark:bg-amber-900/50" />
        <div className="absolute inset-y-0 left-[83%] right-0 bg-red-200 dark:bg-red-900/50" />
        {/* marker */}
        {ratio !== null && (
          <div
            className={`absolute inset-y-0 w-1 rounded-full ${style.bar}`}
            style={{ left: `calc(${pct}% - 2px)` }}
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">
          {ratio !== null ? ratio.toFixed(2) : "—"}
        </span>
        <span className="text-xs text-gray-400">急性 {data?.acuteLoad ?? 0} / 慢性 {data?.chronicLoad ?? 0} (kg·次)</span>
      </div>

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{data?.message}</p>
      <p className="mt-1 text-[11px] text-gray-400">{data?.note}</p>
    </div>
  );
}
