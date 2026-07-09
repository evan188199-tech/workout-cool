"use client";

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { useMuscleVolume } from "../hooks/use-muscle-volume";

const STATUS_COLOR: Record<string, string> = {
  undertrained: "#0ea5e9", // sky
  optimal: "#10b981", // emerald
  high: "#f59e0b", // amber
  overreach: "#ef4444", // red
};

export function MuscleVolumeBars() {
  const tzOffsetMinutes = -new Date().getTimezoneOffset();
  const { data = [], isLoading } = useMuscleVolume(tzOffsetMinutes);

  if (isLoading) {
    return <div className="rounded-xl border p-4 text-sm text-gray-500">加载肌群周容量…</div>;
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-sm text-gray-500">
        暂无训练记录,先去练几次吧。
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="mb-1 text-sm font-semibold">本周肌群组数</h3>
      <p className="mb-3 text-[11px] text-gray-400">Schoenfeld 最佳区间 10-20 组/周</p>

      <ResponsiveContainer width="100%" height={Math.max(data.length * 32, 120)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, "dataMax + 2"]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="muscleLabel" width={56} tick={{ fontSize: 12 }} />
          <ReferenceLine x={10} stroke="#0ea5e9" strokeDasharray="3 3" />
          <ReferenceLine x={20} stroke="#10b981" strokeDasharray="3 3" />
          <ReferenceLine x={25} stroke="#ef4444" strokeDasharray="3 3" />
          <Bar dataKey="weeklySets" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.muscle} fill={STATUS_COLOR[entry.status] ?? "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
