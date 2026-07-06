import { ACWRInput, ACWRResult, RiskZone, SetEntry } from "./types";
import { toLocalInstant, localWeekStart, addDays, MS_PER_DAY } from "./date-utils";

// FIX #1 (unit-mixing disaster): ACWR load counts STRENGTH volume only
// (weightKg * reps). Cardio (durationSec) and pure-bodyweight reps use fatigue
// units that are NOT comparable to strength tonnage (3600s of running != 3600
// of squat volume). They are excluded here. A separate time-based ACWR curve
// can be added later if you track endurance. Mixing them would let one cardio
// day spike the ratio and falsely trigger a red light.
function strengthVolume(s: SetEntry): number {
  return s.weightKg > 0 && s.reps > 0 ? s.weightKg * s.reps : 0;
}

function classifyZone(ratio: number | null): RiskZone {
  if (ratio === null) return "insufficient-data";
  if (ratio < 0.8) return "undertrained";
  if (ratio <= 1.3) return "green";
  if (ratio <= 1.5) return "yellow";
  return "red";
}

const MESSAGES: Record<RiskZone, string> = {
  green: "最佳区间:训练量增长平稳,受伤风险低。",
  yellow: "警戒:本周力量容量增长偏快,注意关节感受。",
  red: "危险:急性负荷超过慢性负荷 1.5 倍,受伤风险约翻倍。建议安排休息或减量日。",
  undertrained: "训练量低于基线,安全但在掉状态。",
  "insufficient-data": "数据不足:至少需要约 14 天力量训练记录。",
};

const NOTE = "仅统计力量训练容量(重量×次数),有氧/计时训练已排除。";

export function calculateACWR(input: ACWRInput): ACWRResult {
  const {
    sets,
    asOf = new Date(),
    acuteDays = 7,
    chronicDays = 28,
    model = "rolling",
    ewmaLambda = 2 / (chronicDays + 1),
    tzOffsetMinutes = 0,
  } = input;

  // FIX #2 (timezone): pre-shift every instant into the user's local-instant
  // space so day/week buckets align with their wall-clock (server defaults to UTC).
  const localSets = sets.map((s) => ({ ...s, date: toLocalInstant(s.date, tzOffsetMinutes) }));
  const localAsOf = toLocalInstant(asOf, tzOffsetMinutes);

  const volumeBetween = (start: Date, end: Date) =>
    localSets.reduce((sum, s) => {
      const t = s.date.getTime();
      return t >= start.getTime() && t < end.getTime() ? sum + strengthVolume(s) : sum;
    }, 0);

  // Need >= 14 days of history before the ratio is meaningful.
  const earliest = localSets.length
    ? Math.min(...localSets.map((s) => s.date.getTime()))
    : localAsOf.getTime();
  if (localAsOf.getTime() - earliest < 14 * MS_PER_DAY) {
    return {
      ratio: null,
      acuteLoad: 0,
      chronicLoad: 0,
      zone: "insufficient-data",
      message: MESSAGES["insufficient-data"],
      note: NOTE,
    };
  }

  const acuteStart = addDays(localAsOf, -acuteDays);
  const acuteLoad = volumeBetween(acuteStart, localAsOf);

  let chronicLoad: number;
  if (model === "ewma") {
    const chronicStart = addDays(localAsOf, -chronicDays);
    // FIX #3 (EWMA cold start): seed with the MEAN of the first 7 days, not a
    // single (possibly zero) day, so one rest day doesn't bias the whole curve.
    const SEED_DAYS = 7;
    let prev = volumeBetween(chronicStart, addDays(chronicStart, SEED_DAYS)) / SEED_DAYS;
    for (let d = SEED_DAYS; d < chronicDays; d++) {
      const dayStart = addDays(chronicStart, d);
      const dayVol = volumeBetween(dayStart, addDays(dayStart, 1));
      prev = dayVol * ewmaLambda + prev * (1 - ewmaLambda);
    }
    chronicLoad = prev;
  } else {
    const chronicStart = addDays(localAsOf, -chronicDays);
    // Rolling: total volume over the window expressed as an average week.
    chronicLoad = volumeBetween(chronicStart, localAsOf) / (chronicDays / 7);
  }

  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : null;
  const zone = classifyZone(ratio);

  return {
    ratio: ratio === null ? null : Math.round(ratio * 100) / 100,
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    zone,
    message: MESSAGES[zone],
    note: NOTE,
  };
}
