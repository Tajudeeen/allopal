import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    fileParallelism: false,
    maxConcurrency: 1,
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
  },
});
