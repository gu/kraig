import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so tests don't load the app's TanStack Start/Tailwind plugins
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    environment: "node",
    restoreMocks: true,
  },
});
