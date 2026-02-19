const { PrismaClient } = require("./src/generated/prisma");
const prisma = new PrismaClient();

async function debugInvestments() {
  try {
    const investors = await prisma.investor.findMany({
      select: {
        id: true,
        kode: true,
        nama: true,
      },
    });

    console.log(`Total investors: ${investors.length}`);

    const currentDate = new Date();
    const endOfMonthForSaldo = currentDate; // Assuming current month

    console.log(`End of month for saldo: ${endOfMonthForSaldo}`);

    const mutasiWhereCondition = {
      investorId: { in: investors.map((inv) => inv.id) },
      admin2_status: "APPROVE",
      tanggal: { lte: endOfMonthForSaldo },
    };

    const allMutasiRecords = await prisma.mutasiRecord.findMany({
      where: mutasiWhereCondition,
      select: {
        investorId: true,
        mutasi: true,
        nilai_mutasi: true,
        tanggal: true,
        admin2_status: true,
      },
    });

    console.log(`Total mutasi records: ${allMutasiRecords.length}`);

    // Group by investor
    const mutasiByInvestor = {};
    allMutasiRecords.forEach((record) => {
      if (!mutasiByInvestor[record.investorId]) {
        mutasiByInvestor[record.investorId] = [];
      }
      mutasiByInvestor[record.investorId].push(record);
    });

    console.log("Mutasi per investor:");
    investors.forEach((investor) => {
      const records = mutasiByInvestor[investor.id] || [];
      console.log(`${investor.kode}: ${records.length} records`);
      if (records.length > 0) {
        records.forEach((r) =>
          console.log(`  ${r.tanggal} ${r.mutasi} ${r.nilai_mutasi}`),
        );
      }
    });

    // Calculate saldos
    const saldoByInvestor = new Map();
    for (const record of allMutasiRecords) {
      const currentSaldo = saldoByInvestor.get(record.investorId) || 0;
      const nilai = Number(record.nilai_mutasi);
      if (record.mutasi === "KREDIT") {
        saldoByInvestor.set(record.investorId, currentSaldo + nilai);
      } else {
        saldoByInvestor.set(record.investorId, currentSaldo - nilai);
      }
    }

    let totalSaldo = 0;
    investors.forEach((investor) => {
      const saldo = saldoByInvestor.get(investor.id) || 0;
      totalSaldo += saldo;
      console.log(`${investor.kode}: saldo ${saldo}`);
    });

    // Check breakdowns
    const breakdowns = await prisma.breakdown.findMany({
      select: {
        tanggal: true,
        nilai: true,
      },
    });

    console.log(`Total breakdowns: ${breakdowns.length}`);
    let totalModal = 0;
    breakdowns.forEach((b) => {
      console.log(`${b.tanggal} ${b.nilai}`);
      totalModal += Number(b.nilai);
    });
    console.log(`Total modal: ${totalModal}`);

    console.log(`Total saldo: ${totalSaldo}`);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

debugInvestments();
