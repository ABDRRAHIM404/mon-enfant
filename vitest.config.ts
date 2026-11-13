import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    maxWorkers: 1,
    isolate: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
