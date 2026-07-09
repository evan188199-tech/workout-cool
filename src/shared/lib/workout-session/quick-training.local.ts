import type { QuickTimeBudget } from "@/features/training-science/model/quick-session";

const STORAGE_KEY = "quickTrainingTimeBudget";
const DEFAULT_BUDGET: QuickTimeBudget = 10;

export const quickTrainingLocal = {
  getTimeBudget(): QuickTimeBudget {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw === "5" || raw === "10" || raw === "15" ? Number(raw) : DEFAULT_BUDGET;
      return parsed as QuickTimeBudget;
    } catch {
      return DEFAULT_BUDGET;
    }
  },

  setTimeBudget(budget: QuickTimeBudget): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(budget));
    } catch {
      // localStorage may be unavailable (private mode); fail silently.
    }
  },
};
