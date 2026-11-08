/**
 * Resolves the project-local Prisma CLI entry point across versions.
 * Prisma 5.x: node_modules/prisma/build/index.js
 * Prisma 6+:  may differ; falls back to require.resolve("prisma")
 *
 * Usage:
 *   import { prismaCli } from "./scripts/prisma-cli.mjs";
 *   spawnSync(process.execPath, [prismaCli, "generate"], { stdio: "inherit" });
 */
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));

/** Known candidate paths (checked in order). */
const candidates = [
  resolve(root, "node_modules/prisma/build/index.js"),
  resolve(root, "node_modules/prisma/dist/index.js"),
  resolve(root, "node_modules/.bin/prisma"),
];

function find() {
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Last resort: ask Node module resolution
  const require = createRequire(resolve(root, "package.json"));
  return require.resolve("prisma");
}

export const prismaCli = find();
