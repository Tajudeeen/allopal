import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

describe("Existing database migration", () => {
  it("creates a missing SQLite file and preserves data when the deployment command is repeated", async () => {
    const directory = mkdtempSync(join(tmpdir(), "allopal-fresh-"));
    const database = join(directory, "nested", "fresh.db");
    const run = () =>
      spawnSync(process.execPath, ["scripts/db-deploy.mjs"], {
        env: { ...process.env, DATABASE_URL: `file:${database}` },
        encoding: "utf8",
      });
    let db: PrismaClient | undefined;
    try {
      const first = run();
      expect(first.status, first.stdout + first.stderr).toBe(0);
      db = new PrismaClient({ datasourceUrl: `file:${database}` });
      await db.systemHealth.create({
        data: { id: "preserve-on-redeploy", status: "HEALTHY" },
      });
      await db.$disconnect();
      const second = run();
      expect(second.status, second.stdout + second.stderr).toBe(0);
      expect(
        (
          await db.systemHealth.findUniqueOrThrow({
            where: { id: "preserve-on-redeploy" },
          })
        ).status,
      ).toBe("HEALTHY");
    } finally {
      await db?.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60000);
  it("preserves legacy financial rows and quarantines unbound pending approvals", async () => {
    const directory = mkdtempSync(join(tmpdir(), "allopal-migration-"));
    const database = join(directory, "legacy.db");
    writeFileSync(database, "");
    const db = new PrismaClient({ datasourceUrl: `file:${database}` });
    async function apply(path: string) {
      for (const sql of readFileSync(path, "utf8").split(";"))
        if (sql.trim()) await db.$executeRawUnsafe(sql);
    }
    try {
      await apply("prisma/migrations/202610180001_initial/migration.sql");
      await db.$executeRawUnsafe(
        "INSERT INTO Mandate VALUES ('legacy','Legacy',4000,1800,0,9999999999999,'ACTIVE','[]','[]',0,0)",
      );
      await db.$executeRawUnsafe(
        "INSERT INTO Product VALUES ('p','Notebook',1800,'Campus Books','School Supplies',0,0)",
      );
      await db.$executeRawUnsafe(
        "INSERT INTO Cart VALUES ('c','Campus Books',1800,0,0)",
      );
      await db.$executeRawUnsafe(
        "INSERT INTO Decision VALUES ('d','legacy','c',1800,'Campus Books','School Supplies','ALLOWED','test','{}','legacy-order',0)",
      );
      await db.$executeRawUnsafe(
        "INSERT INTO PayPalTransaction VALUES ('t','legacy-order',NULL,'legacy','d',1800,'USD','CREATED',NULL,0)",
      );
      await apply(
        "prisma/migrations/202610180002_payment_recovery/migration.sql",
      );
      const attempt = await db.payPalTransaction.findUniqueOrThrow({
        where: { id: "t" },
      });
      expect(attempt.status).toBe("REVIEW_REQUIRED");
      expect(attempt.returnToken).toHaveLength(64);
      expect(attempt.providerCalled).toBe(true);
      expect(attempt.reservationReleased).toBe(false);
      expect(
        (await db.mandate.findUniqueOrThrow({ where: { id: "legacy" } }))
          .spentAmount,
      ).toBe(1800);
      expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
    } finally {
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60000);
});
