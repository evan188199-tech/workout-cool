"use client";

import { ACWRGauge } from "./ACWRGauge";
import { MuscleVolumeBars } from "./MuscleVolumeBars";

// Composes the two always-on widgets. ProgressiveOverloadCard is per-exercise
// and belongs on the exercise statistics page, not the dashboard overview.
export function AnalyticsDashboard() {
  return (
    <div className="space-y-4">
      <ACWRGauge />
      <MuscleVolumeBars />
    </div>
  );
}
