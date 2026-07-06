// Timezone-safe date helpers (zero dependencies).
// See date-fns caveat in WORKOUT-ANALYTICS-DEPLOY.md.

const DAY_MS = 86_400_000;

export const MS_PER_DAY = DAY_MS;

export function toLocalInstant(date: Date, tzOffsetMinutes = 0): Date {
  return new Date(date.getTime() + tzOffsetMinutes * 60_000);
}

export function localWeekStart(localDate: Date): Date {
  const day = localDate.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate() + diff),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function differenceInDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}
