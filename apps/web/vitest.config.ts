import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/retrouve_test",
      AUTH_SECRET: "secret-de-test-0123456789-abcdefghijklmnopqrstuvwxyz",
      CRON_SECRET: "cron-test",
      PUSH_DISABLED: "1",
    },
  },
});
