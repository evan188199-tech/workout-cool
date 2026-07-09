"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  // next-themes injects an inline <script> to prevent theme FOUC. React 19
  // warns about client-rendered <script> tags because they never execute.
  // Tagging it as type="application/json" only on the client makes React treat
  // it as a data block and skip the warning. During SSR the script has no type
  // (so the browser executes it for FOUC prevention), and suppressHydrationWarning
  // (already set by next-themes on the script) covers the resulting mismatch.
  const scriptProps =
    typeof window !== "undefined" ? { type: "application/json" } : undefined;
  return (
    <NextThemesProvider {...props} scriptProps={scriptProps}>
      {children}
    </NextThemesProvider>
  );
}
