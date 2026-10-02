import { PrismaClient } from "@prisma/client";

// Ensure .env is loaded if running tsx
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {}
}

const prisma = new PrismaClient();

export async function seed() {
  console.log("🌱 Resetting and seeding deterministic Allopal data...");

  // 1. Clean existing records in correct foreign key order
  await prisma.payPalTransaction.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.mandate.deleteMany();
  await prisma.systemHealth.deleteMany();

  // 2. Deterministic School Shopping Mandate
  // Limit: $40.00 (4000 cents), Duration: 7 days, School Supplies, Campus Books & Paper & Pencil
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const mandate = await prisma.mandate.create({
    data: {
      id: "mandate-school-shopping",
      name: "School Shopping",
      weeklyLimit: 4000, // $40.00
      spentAmount: 0,
      validFrom: now,
      validUntil: sevenDaysFromNow,
      status: "ACTIVE",
      allowedCategories: JSON.stringify(["School Supplies"]),
      allowedMerchants: JSON.stringify(["Campus Books", "Paper & Pencil"]),
    },
  });

  // 3. Products
  const notebook = await prisma.product.create({
    data: {
      id: "prod-notebook-bundle",
      name: "Notebook Bundle",
      price: 1800, // $18.00
      merchant: "Campus Books",
      category: "School Supplies",
    },
  });

  const headset = await prisma.product.create({
    data: {
      id: "prod-gaming-headset",
      name: "Gaming Headset",
      price: 9000, // $90.00
      merchant: "Campus Books",
      category: "Electronics",
    },
  });

  const deluxeNotebook = await prisma.product.create({
    data: {
      id: "prod-deluxe-notebook",
      name: "Deluxe Notebook Pack",
      price: 2500, // $25.00
      merchant: "Campus Books",
      category: "School Supplies",
    },
  });

  const pocketNotebook = await prisma.product.create({
    data: {
      id: "prod-pocket-notebook",
      name: "Pocket Notebook",
      price: 800, // $8.00
      merchant: "Campus Books",
      category: "School Supplies",
    },
  });

  const sketchpad = await prisma.product.create({
    data: {
      id: "prod-sketchpad-pencil",
      name: "Sketchpad & Pencil Set",
      price: 1200, // $12.00
      merchant: "Paper & Pencil",
      category: "School Supplies",
    },
  });

  // 4. Deterministic Carts for Primary Demo Scenarios
  // Case A Cart: $18 notebook bundle from Campus Books, School Supplies
  const cartCaseA = await prisma.cart.create({
    data: {
      id: "cart-case-a",
      merchant: "Campus Books",
      totalAmount: 1800,
      items: {
        create: [
          {
            productId: notebook.id,
            quantity: 1,
            price: 1800,
          },
        ],
      },
    },
  });

  // Case B Cart: $90 gaming headset from Campus Books, Electronics
  const cartCaseB = await prisma.cart.create({
    data: {
      id: "cart-case-b",
      merchant: "Campus Books",
      totalAmount: 9000,
      items: {
        create: [
          {
            productId: headset.id,
            quantity: 1,
            price: 9000,
          },
        ],
      },
    },
  });

  // Case C Cart: $25 deluxe notebook purchase
  const cartCaseC = await prisma.cart.create({
    data: {
      id: "cart-case-c",
      merchant: "Campus Books",
      totalAmount: 2500,
      items: {
        create: [
          {
            productId: deluxeNotebook.id,
            quantity: 1,
            price: 2500,
          },
        ],
      },
    },
  });

  // Case D Cart: $8 notebook purchase
  const cartCaseD = await prisma.cart.create({
    data: {
      id: "cart-case-d",
      merchant: "Campus Books",
      totalAmount: 800,
      items: {
        create: [
          {
            productId: pocketNotebook.id,
            quantity: 1,
            price: 800,
          },
        ],
      },
    },
  });

  console.log("✅ Seeding complete:");
  console.log(` - Mandate: ${mandate.name} ($${(mandate.weeklyLimit / 100).toFixed(2)})`);
  console.log(` - Products: 5 items seeded`);
  console.log(` - Carts: Cases A, B, C, D seeded`);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
