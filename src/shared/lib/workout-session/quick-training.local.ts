import type { QuickTimeBudget } from "@/features/training-science/model/quick-session";

const STORAGE_KEY = "quickTrainingTimeBudget";
const DEFAULT_BUDGET: QuickTimeBudget = 10;
const VALID_BUDGETS = new Set<QuickTimeBudget>([5, 10, 15, 20, 25]);

export const quickTrainingLocal = {
  getTimeBudget(): QuickTimeBudget {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw !== null ? Number(raw) : DEFAULT_BUDGET;
      return VALID_BUDGETS.has(parsed as QuickTimeBudget) ? (parsed as QuickTimeBudget) : DEFAULT_BUDGET;
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
