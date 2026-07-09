import type { Metadata } from "next";
import { getTrainingPlan } from "@/features/training-science/actions/training-plan.action";
import { PlanPage } from "@/features/training-science/ui/plan-page";

export const metadata: Metadata = {
  title: "My Training Plan",
};

export default async function Page() {
  const plan = await getTrainingPlan().catch(() => null);
  return <PlanPage plan={plan} />;
}
