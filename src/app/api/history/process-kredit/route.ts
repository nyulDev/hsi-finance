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

    const threeMonthsLater = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 3,
      1,
    );

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

    // Get 3 months ago start and end
    const threeMonthsAgo = new Date(currentDate);
    threeMonthsAgo.setMonth(currentDate.getMonth() - 3);
    const startOfThreeMonthsAgo = new Date(
      threeMonthsAgo.getFullYear(),
      threeMonthsAgo.getMonth(),
      1,
    );
    const endOfThreeMonthsAgo = new Date(
      threeMonthsAgo.getFullYear(),
      threeMonthsAgo.getMonth() + 1,
      0,
    );

    // Get all latest saldos for current month to calculate total
    const startOfCurrentMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const endOfCurrentMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    const saldoMap = new Map<string, number>();
    let totalSaldo = 0;

    // Fetch the latest mutasiRecord for all investors in a single query
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

    // Populate the saldoMap
    for (const record of latestRecords) {
      if (record.investorId) {
        saldoMap.set(record.investorId, Number(record.saldo_akhir));
      }
    }

    // Include all valid investors and calculate totalSaldo
    investors
      .filter((investor) => investor.kode)
      .forEach((investor) => {
        const saldo = saldoMap.get(investor.id) || 0;
        totalSaldo += saldo;
      });

    // Calculate Modal: total nilai from breakdowns for current month
    const modalAggregate = await prisma.breakdown.aggregate({
      where: {
        tanggal: {
          gte: startOfCurrentMonth,
          lte: endOfCurrentMonth,
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

    // Bagi Hasil: 5% of modal, then deduct 5% admin fee
    const bagiHasil = 0.05 * modal * 0.95;
    
    console.log("Profit Sharing Calculations:", { modal, totalSaldo, bagiHasil });

    const mutationsToCreate: any[] = [];

    for (let i = 0; i < investors.length; i++) {
      const investor = investors[i];
      if (!investor.kode) continue;

      const previousSaldo = saldoMap.get(investor.id) || 0;

      // Calculate persen
      const persen = totalSaldo > 0 ? (previousSaldo / totalSaldo) * 100 : 0;

      // Calculate bagi_hasil: persen / 100 * bagiHasil
      const bagi_hasil = (persen / 100) * bagiHasil;

      // nilai_mutasi for kredit: bagi_hasil
      const nilaiMutasi = bagi_hasil;

      if (nilaiMutasi > 0) {
        const newSaldo = previousSaldo + nilaiMutasi;

        mutationsToCreate.push({
          tanggal: threeMonthsLater,
          kode: investor.kode,
          nama: investor.nama,
          rekening_bank: investor.rekening_bank,
          mutasi: "KREDIT",
          nilai_mutasi: nilaiMutasi,
          saldo_akhir: newSaldo,
          keterangan: `Profit Sharing (${
            monthNames[currentDate.getMonth()]
          })`,
          investorId: investor.id,
        });

        console.log(
          `Kredit calculated for investor ${investor.kode}: ${nilaiMutasi}`,
        );
      }
    }

    if (mutationsToCreate.length > 0) {
      await prisma.mutasiRecord.createMany({
        data: mutationsToCreate,
      });
      console.log(`Successfully batch inserted ${mutationsToCreate.length} kredit mutations.`);
    }

    return NextResponse.json({
      message: "Kredit mutations processed successfully",
    });
  } catch (error) {
    console.error("Error processing kredit mutations:", error);
    return NextResponse.json(
      { error: "Internal server error during kredit processing" },
      { status: 500 },
    );
  }
}
