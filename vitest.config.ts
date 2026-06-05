import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/__tests__/**/*.test.ts"],
    // server/db.ts throws at import time unless DATABASE_URL is set. The pg Pool is
    // lazy (no connection opened until a query runs), so a dummy URL is safe for the
    // pure-function unit tests, which never touch the database.
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./shared"),
      "@": resolve(__dirname, "./client"),
    },
  },
});
