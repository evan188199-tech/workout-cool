import { ProgressionInput, ProgressionResult } from "./types";
import { toLocalInstant } from "./date-utils";

const SUGGESTED_STEP_KG = 2.5; // conservative upper-body heuristic; user overrides
const PLATEAU_LOOKBACK = 3; // compare last session vs N sessions ago
const MIN_SESSIONS = 4; // need this many sessions to judge a trend

export function getProgression(input: ProgressionInput): ProgressionResult {
  const { sets, exerciseId, tzOffsetMinutes = 0 } = input;

  // Group sets by LOCAL session date (FIX #2) -> max weight that day.
  const bySession = new Map<string, { date: Date; maxWeight: number }>();
  for (const s of sets) {
    const local = toLocalInstant(s.date, tzOffsetMinutes);
    const key = local.toISOString().slice(0, 10); // local YYYY-MM-DD
    const existing = bySession.get(key);
    if (!existing || s.weightKg > existing.maxWeight) {
      bySession.set(key, { date: s.date, maxWeight: s.weightKg });
    }
  }

  const sessions = Array.from(bySession.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  if (sessions.length < MIN_SESSIONS) {
    return {
      exerciseId,
      lastMaxWeight: sessions.at(-1)?.maxWeight ?? 0,
      previousMaxWeight: 0,
      trend: "insufficient-data",
      suggestedIncrementKg: null,
      message: `至少需要 ${MIN_SESSIONS} 次训练才能判断趋势。`,
    };
  }

  const lastMax = sessions.at(-1)!.maxWeight;
  const prevMax = sessions.at(-1 - PLATEAU_LOOKBACK)!.maxWeight;

  let trend: ProgressionResult["trend"];
  let suggestedIncrementKg: number | null = null;
  let message: string;

  if (lastMax > prevMax + 0.5) {
    trend = "increasing";
    message = "重量在上升,渐进超负荷良好。";
  } else if (lastMax < prevMax - 0.5) {
    trend = "decreasing";
    message = "重量下降,检查恢复或动作质量。";
  } else {
    trend = "plateau";
    suggestedIncrementKg = SUGGESTED_STEP_KG;
    message = `平台期:最近 ${PLATEAU_LOOKBACK + 1} 次训练重量无变化,建议下次 +${SUGGESTED_STEP_KG}kg。`;
  }

  return {
    exerciseId,
    lastMaxWeight: lastMax,
    previousMaxWeight: prevMax,
    trend,
    suggestedIncrementKg,
    message,
  };
}
