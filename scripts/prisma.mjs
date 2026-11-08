#!/usr/bin/env node
/**
 * Wrapper that forwards arguments to the project-local Prisma CLI.
 * Works across Prisma 5.x (build/index.js) and later versions.
 *
 * Usage:  node scripts/prisma.mjs generate
 *         node scripts/prisma.mjs migrate deploy
 */
import { prismaCli } from "./prisma-cli.mjs";
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exitCode = result.status ?? 1;
