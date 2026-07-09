"use client";

import { useSession } from "@/features/auth/lib/auth-client";

export function useUserSubscription() {
  const { data: session, ...rest } = useSession();
  // Self-hosted policy: every logged-in user is VIP (premium, no ads). This
  // gates ad display (AdWrapper / AdBlockerForPremium / PremiumGate).
  const isPremium = !!session?.user || (session?.user?.isPremium ?? true);

  return { isPremium, ...rest };
}
