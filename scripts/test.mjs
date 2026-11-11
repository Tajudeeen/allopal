import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { prismaCli } from "./prisma-cli.mjs";
const directory = mkdtempSync(join(tmpdir(), "allopal-tests-"));
const database = join(directory, "test.db");
writeFileSync(database, "");
const env = {
  ...process.env,
  NODE_ENV: "test",
  ALLOPAL_TEST_RUN: "1",
  DATABASE_URL: `file:${database}`,
  PAYPAL_CLIENT_ID: "ci-contract-client",
  PAYPAL_CLIENT_SECRET: "ci-contract-secret",
  PAYPAL_API_BASE_URL: "https://api-m.sandbox.paypal.com",
  GROQ_API_KEY: "ci-groq-contract-key",
};
try {
  const migration = spawnSync(
    process.execPath,
    [prismaCli, "migrate", "deploy"],
    { env, stdio: "inherit" },
  );
  if (migration.status !== 0) process.exitCode = migration.status || 1;
  else {
    const watch = process.argv.includes("--watch");
    const args = process.argv.slice(2).filter((arg) => arg !== "--watch");
    const run = spawnSync(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", ...(watch ? [] : ["run"]), ...args],
      { env, stdio: "inherit" },
    );
    process.exitCode = run.status || (run.signal ? 1 : 0);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
