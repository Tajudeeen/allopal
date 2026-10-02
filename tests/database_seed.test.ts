import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";

describe("Step 2: Database Schema & Deterministic Seed Audit", () => {
  beforeAll(async () => {
    await seed();
  });

  it("seeds the primary School Shopping mandate with exact integer cents and active status", async () => {
    const mandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });

    expect(mandate).not.toBeNull();
    expect(mandate?.name).toBe("School Shopping");
    expect(mandate?.weeklyLimit).toBe(4000); // $40.00
    expect(mandate?.spentAmount).toBe(0);
    expect(mandate?.status).toBe("ACTIVE");

    // Exact integer check
    expect(Number.isInteger(mandate?.weeklyLimit)).toBe(true);
    expect(Number.isInteger(mandate?.spentAmount)).toBe(true);

    const categories = JSON.parse(mandate?.allowedCategories || "[]");
    expect(categories).toEqual(["School Supplies"]);

    const merchants = JSON.parse(mandate?.allowedMerchants || "[]");
    expect(merchants).toContain("Campus Books");
    expect(merchants).toContain("Paper & Pencil");

    expect(new Date(mandate!.validUntil).getTime()).toBeGreaterThan(
      new Date(mandate!.validFrom).getTime()
    );
  });

  it("seeds the authoritative products for test cases with exact integer cents", async () => {
    const notebook = await prisma.product.findUnique({
      where: { id: "prod-notebook-bundle" },
    });
    expect(notebook).not.toBeNull();
    expect(notebook?.price).toBe(1800); // $18.00
    expect(notebook?.merchant).toBe("Campus Books");
    expect(notebook?.category).toBe("School Supplies");

    const headset = await prisma.product.findUnique({
      where: { id: "prod-gaming-headset" },
    });
    expect(headset).not.toBeNull();
    expect(headset?.price).toBe(9000); // $90.00
    expect(headset?.merchant).toBe("Campus Books");
    expect(headset?.category).toBe("Electronics");
  });

  it("seeds primary demo carts with verified items and totals", async () => {
    const cartA = await prisma.cart.findUnique({
      where: { id: "cart-case-a" },
      include: { items: { include: { product: true } } },
    });

    expect(cartA).not.toBeNull();
    expect(cartA?.totalAmount).toBe(1800);
    expect(cartA?.merchant).toBe("Campus Books");
    expect(cartA?.items.length).toBe(1);
    expect(cartA?.items[0].product.name).toBe("Notebook Bundle");
    expect(cartA?.items[0].product.category).toBe("School Supplies");

    const cartB = await prisma.cart.findUnique({
      where: { id: "cart-case-b" },
      include: { items: { include: { product: true } } },
    });
    expect(cartB?.totalAmount).toBe(9000);
    expect(cartB?.items[0].product.category).toBe("Electronics");
  });

  it("verifies that revoked status cannot be conflated with active", async () => {
    const testMandate = await prisma.mandate.create({
      data: {
        name: "Revocation Test",
        weeklyLimit: 5000,
        spentAmount: 0,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 100000),
        status: "REVOKED",
        allowedCategories: "[]",
        allowedMerchants: "[]",
      },
    });

    expect(testMandate.status).toBe("REVOKED");
    expect(testMandate.status).not.toBe("ACTIVE");

    await prisma.mandate.delete({ where: { id: testMandate.id } });
  });
});
