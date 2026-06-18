import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const investors = await prisma.investor.findMany({
      select: {
        id: true,
        kode: true,
        nama: true,
        rekening_bank: true,
      },
    });

    const currentDate = new Date();
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    // Get current month start and end
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    // Fetch all kredit sums up to currentDate for all investors
    const groupedKredit = await prisma.mutasiRecord.groupBy({
      by: ["investorId"],
      where: {
        tanggal: { lte: currentDate },
        mutasi: "KREDIT",
      },
      _sum: { nilai_mutasi: true },
    });

    // Fetch all debet sums up to currentDate for all investors
    const groupedDebet = await prisma.mutasiRecord.groupBy({
      by: ["investorId"],
      where: {
        tanggal: { lte: currentDate },
        mutasi: "DEBET",
      },
      _sum: { nilai_mutasi: true },
    });

    const kreditMap = new Map(
      groupedKredit.map((g) => [g.investorId, Number(g._sum.nilai_mutasi || 0)]),
    );
    const debetMap = new Map(
      groupedDebet.map((g) => [g.investorId, Number(g._sum.nilai_mutasi || 0)]),
    );

    // Get all saldos using the same method as investments page (sum kredit - sum debet up to current date)
    const saldoMap = new Map<string, number>();
    let totalSaldo = 0;

    investors
      .filter((investor) => investor.kode)
      .forEach((investor) => {
        const kredit = kreditMap.get(investor.id) || 0;
        const debet = debetMap.get(investor.id) || 0;
        const saldo = kredit - debet;
        saldoMap.set(investor.id, saldo);
        totalSaldo += saldo;
      });

    const allLatestRecords = investors.map(
      (investor) => saldoMap.get(investor.id) || 0,
    );

    // Calculate modal: sum of nilai from breakdowns for current month
    const modalAggregate = await prisma.breakdown.aggregate({
      where: {
        tanggal: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        nilai: true,
      },
    });
    const modal = modalAggregate._sum?.nilai
      ? Number(modalAggregate._sum.nilai)
      : 0;

    // Persen-M: modal / totalSaldo * 100, capped at 100%
    const persenM =
      totalSaldo > 0 ? Math.min(100, (modal / totalSaldo) * 100) : 0;

    // Fetch the absolute latest mutasiRecord for all investors in a single query to compute the new saldo_akhir
    const latestRecords = await prisma.mutasiRecord.findMany({
      distinct: ["investorId"],
      orderBy: [
        { tanggal: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        investorId: true,
        saldo_akhir: true,
      },
    });

    const latestSaldoMap = new Map<string, number>();
    for (const record of latestRecords) {
      if (record.investorId) {
        latestSaldoMap.set(record.investorId, Number(record.saldo_akhir));
      }
    }

    const mutationsToCreate: any[] = [];

    for (let i = 0; i < investors.length; i++) {
      const investor = investors[i];
      if (!investor.kode) continue;

      const saldo = allLatestRecords[i];

      // Calculate dana_terpakai: saldo * (persenM / 100)
      const dana_terpakai = saldo * (persenM / 100);

      // nilai_mutasi for debet: dana_terpakai
      const nilaiMutasi = dana_terpakai;

      if (nilaiMutasi > 0) {
        const previousSaldo = latestSaldoMap.get(investor.id) || 0;
        const newSaldo = previousSaldo - nilaiMutasi;

        mutationsToCreate.push({
          tanggal: currentDate,
          kode: investor.kode,
          nama: investor.nama,
          rekening_bank: investor.rekening_bank,
          mutasi: "DEBET",
          nilai_mutasi: nilaiMutasi,
          saldo_akhir: newSaldo,
          keterangan: `Dana terpakai ${monthNames[currentDate.getMonth()]}`,
          investorId: investor.id,
          admin1_status: "APPROVE",
          admin2_status: "APPROVE",
        });

        console.log(
          `Debet calculated for investor ${investor.kode}: ${nilaiMutasi}`,
        );
      }
    }

    if (mutationsToCreate.length > 0) {
      await prisma.mutasiRecord.createMany({
        data: mutationsToCreate,
      });
      console.log(`Successfully batch inserted ${mutationsToCreate.length} debet mutations.`);
    }

    return NextResponse.json({
      message: "Debet mutations processed successfully",
    });
  } catch (error) {
    console.error("Error processing debet mutations:", error);
    return NextResponse.json(
      { error: "Internal server error during debet processing" },
      { status: 500 },
    );
  }
}
