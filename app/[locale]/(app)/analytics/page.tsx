import type { Metadata } from "next";

import { getI18n } from "locales/server";

import { AnalyticsDashboard } from "@/features/workout-analytics";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n();
  return {
    title: "训练分析",
    description: "ACWR 急慢性负荷预警与肌群周容量",
  };
}

export default async function AnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-2 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">训练分析</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          基于运动科学的负荷管理与容量均衡。ACWR &gt; 1.5 受伤风险显著上升。
        </p>
      </header>

      <AnalyticsDashboard />
    </div>
  );
}
