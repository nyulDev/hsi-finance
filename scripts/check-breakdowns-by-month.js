const { PrismaClient } = require("../src/generated/prisma");

const prisma = new PrismaClient();

async function checkBreakdownsByMonth() {
  try {
    // Get all breakdowns grouped by month
    const breakdowns = await prisma.breakdown.findMany({
      select: {
        kode: true,
        nilai: true,
        tanggal: true,
      },
      orderBy: {
        tanggal: "asc",
      },
    });

    console.log("All breakdowns:");
    console.log(breakdowns);

    // Group by month
    const byMonth = {};
    for (const b of breakdowns) {
      const date = new Date(b.tanggal);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[key]) {
        byMonth[key] = { total: 0, count: 0 };
      }
      byMonth[key].total += Number(b.nilai);
      byMonth[key].count += 1;
    }

    console.log("\nBreakdowns by month:");
    for (const [month, data] of Object.entries(byMonth)) {
      console.log(
        `${month}: ${data.count} records, Total nilai: ${data.total}`,
      );
    }

    // Check current year data
    const currentYear = new Date().getFullYear();
    console.log(`\nCurrent year (${currentYear}) breakdowns:`);

    for (let month = 1; month <= 12; month++) {
      const monthBreakdowns = breakdowns.filter((b) => {
        const date = new Date(b.tanggal);
        return (
          date.getFullYear() === currentYear && date.getMonth() + 1 === month
        );
      });
      const total = monthBreakdowns.reduce(
        (sum, b) => sum + Number(b.nilai),
        0,
      );
      console.log(
        `Month ${month}: ${monthBreakdowns.length} records, Total: ${total}`,
      );
    }
  } catch (error) {
    console.error("Error checking data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBreakdownsByMonth();
