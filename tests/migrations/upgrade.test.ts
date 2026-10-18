import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

describe("Existing database migration", () => {
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
  });
});
