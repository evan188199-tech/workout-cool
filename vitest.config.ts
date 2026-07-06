import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/workoutcool": path.resolve(__dirname, "./src"),
      "@emails": path.resolve(__dirname, "./emails"),
      "@public": path.resolve(__dirname, "./public"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
