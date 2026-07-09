"use client";

import { Activity, Dumbbell, Clock, Layers } from "lucide-react";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { useQuery } from "@tanstack/react-query";

import { getOverallStatsAction } from "@/features/statistics/actions/get-overall-stats.action";
import { useSession } from "@/features/auth/lib/auth-client";
import { useI18n } from "locales/client";
import { VolumeChart } from "@/features/statistics/components/VolumeChart";

export function OverallStatsSummary() {
  const t = useI18n();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["overall-stats", userId],
    queryFn: async () => {
      const result = await getOverallStatsAction({ userId: userId! });
      if (result?.serverError) throw new Error(result.serverError);
      return result?.data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-base-100 rounded-lg p-4 border border-base-200 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      icon: Activity,
      label: t("statistics.total_workouts"),
      value: data?.totalWorkouts ?? 0,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Dumbbell,
      label: t("statistics.total_volume"),
      value: data ? `${(data.totalVolume / 1000).toFixed(1)}K` : "0",
      sub: "kg",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      icon: Layers,
      label: t("statistics.total_sets"),
      value: data?.totalSets ?? 0,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Clock,
      label: t("statistics.total_time"),
      value: data ? formatDuration(data.totalWorkoutTime) : "0",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              className="bg-base-100 rounded-lg p-4 border border-base-200 flex flex-col items-center text-center gap-2"
              key={i}
            >
              <div className={`w-10 h-10 rounded-full ${stat.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold">
                {stat.value}
                {stat.sub && <span className="text-sm font-normal text-base-content/50 ml-1">{stat.sub}</span>}
              </div>
              <div className="text-xs text-base-content/60">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {data?.topExercises && data.topExercises.length > 0 && (
        <div className="bg-base-100 rounded-lg p-4 border border-base-200 mb-8">
          <h3 className="text-lg font-semibold mb-3">{t("statistics.top_exercises")}</h3>
          <div className="space-y-2">
            {data.topExercises.map((ex, i) => (
              <div className="flex items-center gap-3" key={ex.id}>
                <span className="text-sm font-bold text-base-content/40 w-5">{i + 1}</span>
                <span className="flex-1 text-sm font-medium truncate">{ex.name}</span>
                <span className="text-sm text-base-content/60">{ex.sets} sets</span>
                <span className="text-sm font-bold text-orange-500 tabular-nums">
                  {ex.volume >= 1000 ? `${(ex.volume / 1000).toFixed(1)}K` : ex.volume} kg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global volume trend across ALL exercises */}
      {data?.volumeTrend && data.volumeTrend.length > 0 && (
        <div className="mb-8">
          <VolumeChart
            data={data.volumeTrend.map((v) => ({
              week: v.weekStart,
              totalVolume: v.totalVolume,
              setCount: v.setCount,
            }))}
            height={300}
          />
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
