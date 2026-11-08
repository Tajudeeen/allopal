import { mkdirSync, closeSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { prismaCli } from "./prisma-cli.mjs";

try {
  process.loadEnvFile?.();
} catch {
  /* Fresh checkout without .env. */
}
const root = fileURLToPath(new URL("../", import.meta.url));
const url = process.env.DATABASE_URL || "file:./dev.db";
if (!url.startsWith("file:"))
  throw new Error("This release requires a SQLite file: DATABASE_URL.");
// Prisma resolves relative SQLite paths against its schema directory, not cwd.
const filename = resolve(root, "prisma", url.slice(5).split("?")[0]);
mkdirSync(dirname(filename), { recursive: true });
closeSync(openSync(filename, "a")); // Create if absent, never truncate existing records.
const result = spawnSync(
  process.execPath,
  [prismaCli, "migrate", "deploy"],
  {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  },
);
process.exitCode = result.status ?? 1;
