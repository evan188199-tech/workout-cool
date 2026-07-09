import type { Metadata } from "next";

import { getServerUrl } from "@/shared/lib/server-url";
import { SiteConfig } from "@/shared/config/site-config";
import { WorkoutStepper } from "@/features/workout-builder";
import { getRecommendedDay } from "@/features/training-science/actions/training-plan.action";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  const isEnglish = locale === "en";
  const title = isEnglish ? "Build Your Perfect Workout" : "Créez Votre Entraînement Parfait";
  const description = isEnglish
    ? "Create free workout routines with our comprehensive exercise database. Track your progress and achieve your fitness goals."
    : "Créez des routines d'entraînement gratuites avec notre base de données d'exercices complète. Suivez vos progrès et atteignez vos objectifs fitness.";

  return {
    title,
    description,
    openGraph: {
      title: `${title} | ${SiteConfig.title}`,
      description,
      images: [{ url: `${getServerUrl()}/images/default-og-image_${locale}.jpg` }],
    },
  };
}

export default async function HomePage() {
  // Server-side: fetch today's recommended training day for logged-in users.
  // Returns null for anonymous users or those without a saved plan.
  const recommendation = await getRecommendedDay().catch(() => null);

  return (
    <div className="bg-background text-foreground relative flex flex-col h-full">
      <WorkoutStepper serverRecommendation={recommendation} />
    </div>
  );
}
