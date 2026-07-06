"use client";

import { useSession } from "@/features/auth/lib/auth-client";

export function useUserSubscription() {
  const { data: session, ...rest } = useSession();
  // Self-hosted: premium features (e.g. advanced statistics) are unlocked for everyone.
  const isPremium = session?.user?.isPremium ?? true;

  return { isPremium, ...rest };
}
