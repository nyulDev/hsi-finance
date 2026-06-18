import { prisma } from "@/lib/prisma";

async function main() {
  const db = prisma;

  try {
    // Minimal check without requiring specific tables/columns.
    // Works for PostgreSQL.
    const result = await prisma.$queryRaw<
      Array<{ ok: number }>
    >`SELECT 1 as ok`;

    console.log("✅ Database connection OK");
    console.log("Query result:", result);
  } catch (err) {
    console.error("❌ Database connection FAILED");

    if (err instanceof Error) {
      console.error("Error:", err.message);
      console.error(err.stack);
    } else {
      console.error(err);
    }

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
