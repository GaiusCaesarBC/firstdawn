import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    sequence: {
      concurrent: false,
    },
    setupFiles: ["./tests/setup/load-env.ts"],
    testTimeout: 30_000,
  },
});
