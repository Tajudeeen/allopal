import { describe, it, expect } from "vitest";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

describe("Foundation Verification", () => {
  it("validates server environment variables correctly", () => {
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.PAYPAL_CLIENT_ID).toBeDefined();
    expect(env.PAYPAL_CLIENT_SECRET).toBeDefined();
  });

  it("successfully connects to the database via Prisma", async () => {
    // Perform a round-trip DB operation
    const testRecord = await prisma.systemHealth.create({
      data: {
        status: "FOUNDATION_TEST",
      },
    });

    expect(testRecord.id).toBeDefined();
    expect(testRecord.status).toBe("FOUNDATION_TEST");

    const found = await prisma.systemHealth.findUnique({
      where: { id: testRecord.id },
    });
    expect(found).not.toBeNull();
    expect(found?.status).toBe("FOUNDATION_TEST");

    // Clean up
    await prisma.systemHealth.delete({
      where: { id: testRecord.id },
    });
  });
});
