import { PrismaClient } from "@prisma/client";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";

declare global {
  // eslint-disable-next-line no-var
  var cachedPrisma: PrismaClient | undefined;
}

// On serverless deployments (e.g. Vercel), ensure SQLite lives on writable /tmp storage
if (
  process.env.ALLOPAL_TEST_RUN !== "1" &&
  (Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_URL))
) {
  const tmpDbPath = resolve(tmpdir(), "allopal-serverless.db");
  if (!existsSync(tmpDbPath)) {
    mkdirSync(dirname(tmpDbPath), { recursive: true });
    const candidateTemplates = [
      resolve(process.cwd(), "prisma/template.db"),
      resolve(__dirname, "../../prisma/template.db"),
    ];
    for (const t of candidateTemplates) {
      if (existsSync(t)) {
        try {
          copyFileSync(t, tmpDbPath);
          break;
        } catch {}
      }
    }
  }
  process.env.DATABASE_URL = `file:${tmpDbPath}`;
}

export const prisma =
  globalThis.cachedPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.cachedPrisma = prisma;
}
