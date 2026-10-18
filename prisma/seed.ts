import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Catalog data is shared and immutable in the demo. Financial data belongs to one workspace.
export async function seed(workspaceId = "demo", protectPending = false) {
  await prisma.$transaction(
    async (db) => {
      if (
        protectPending &&
        (await db.payPalTransaction.count({
          where: {
            mandate: { workspaceId },
            status: {
              notIn: [
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                "REFUNDED",
                "REVERSED",
              ],
            },
          },
        }))
      ) {
        throw new Error("PENDING_PAYMENTS_PREVENT_RESET");
      }
      await db.idempotencyRecord.deleteMany({ where: { workspaceId } });
      await db.payPalTransaction.deleteMany({
        where: { mandate: { workspaceId } },
      });
      await db.decision.deleteMany({ where: { mandate: { workspaceId } } });
      await db.mandate.deleteMany({ where: { workspaceId } });
      const products = [
        {
          id: "prod-notebook-bundle",
          name: "Notebook Bundle",
          price: 1800,
          merchant: "Campus Books",
          category: "School Supplies",
        },
        {
          id: "prod-gaming-headset",
          name: "Gaming Headset",
          price: 9000,
          merchant: "Campus Books",
          category: "Electronics",
        },
        {
          id: "prod-deluxe-notebook",
          name: "Deluxe Notebook Set",
          price: 2500,
          merchant: "Campus Books",
          category: "School Supplies",
        },
        {
          id: "prod-pocket-notebook",
          name: "Pocket Notebook",
          price: 800,
          merchant: "Campus Books",
          category: "School Supplies",
        },
        {
          id: "prod-sketchpad-pencil",
          name: "Sketchpad & Pencil Set",
          price: 1200,
          merchant: "Paper & Pencil",
          category: "School Supplies",
        },
      ];
      for (const product of products)
        await db.product.upsert({
          where: { id: product.id },
          create: product,
          update: {},
        });
      for (const [index, letter] of ["a", "b", "c", "d"].entries()) {
        const product = products[index];
        const id = `cart-case-${letter}`;
        await db.cart.upsert({
          where: { id },
          update: {},
          create: {
            id,
            merchant: product.merchant,
            totalAmount: product.price,
            items: {
              create: [
                { productId: product.id, quantity: 1, price: product.price },
              ],
            },
          },
        });
      }
      await db.mandate.create({
        data: {
          id:
            workspaceId === "demo"
              ? "mandate-school-shopping"
              : `mandate-${workspaceId}`,
          workspaceId,
          name: "School Shopping",
          weeklyLimit: 4000,
          spentAmount: 0,
          status: "ACTIVE",
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60_000),
          allowedCategories: JSON.stringify(["School Supplies"]),
          allowedMerchants: JSON.stringify(["Campus Books", "Paper & Pencil"]),
        },
      });
    },
    { timeout: 10_000 },
  );
}
if (process.argv[1]?.endsWith("seed.ts")) {
  seed()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}
