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

    // Get 3 months in the future date (e.g., clicked in February → transaction in May)
    const threeMonthsLater = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 3,
      1,
    );

    // Get start and end of current month (the month when button is clicked)
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

    // Get all saldos for current month using same method as investments page
    const saldoMap = new Map<string, number>();
    let totalSaldo = 0;

    console.log("Processing saldos for", investors.length, "investors");
    console.log("Date range:", {
      startOfCurrentMonth: startOfCurrentMonth.toISOString(),
      endOfCurrentMonth: endOfCurrentMonth.toISOString(),
    });

    const investorsWithKode = investors.filter((investor) => investor.kode);
    console.log("Investors with kode:", investorsWithKode.length);

    await Promise.all(
      investorsWithKode.map(async (investor) => {
        console.log("Processing investor:", investor.kode, investor.id);

        const kreditSum = await prisma.mutasiRecord.aggregate({
          where: {
            investorId: investor.id,
            tanggal: { lte: endOfCurrentMonth },
            mutasi: "KREDIT",
          },
          _sum: { nilai_mutasi: true },
        });

        const debetSum = await prisma.mutasiRecord.aggregate({
          where: {
            investorId: investor.id,
            tanggal: { lte: endOfCurrentMonth },
            mutasi: "DEBET",
          },
          _sum: { nilai_mutasi: true },
        });

        const saldo =
          Number(kreditSum._sum.nilai_mutasi || 0) -
          Number(debetSum._sum.nilai_mutasi || 0);
        saldoMap.set(investor.id, saldo);
        totalSaldo += saldo;
      }),
    );

    // Calculate Modal: total nilai from breakdowns for current month (the month when button is clicked)
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

    // Dana Tersedia is totalSaldo (same as investments page)
    const danaTersedia = totalSaldo;

    // Persen-M: modal / danaTersedia * 100 (capped at 100)
    const persenM =
      danaTersedia > 0 ? Math.min(100, (modal / danaTersedia) * 100) : 0;

    console.log("Calculations:", { modal, danaTersedia, persenM, totalSaldo });

    for (let i = 0; i < investors.length; i++) {
      const investor = investors[i];
      if (!investor.kode) continue;

      const saldo = saldoMap.get(investor.id) || 0;

      // Calculate dana_terpakai: saldo * (persenM / 100) - same as investments page
      const dana_terpakai = saldo * (persenM / 100);

      // nilai_mutasi for kredit: dana_terpakai from current month
      const nilaiMutasi = dana_terpakai;

      console.log("Investor:", investor.kode, {
        saldo,
        dana_terpakai,
        nilaiMutasi,
      });

      if (nilaiMutasi > 0) {
        // Get last saldo for this investor
        const lastTransaction = await prisma.mutasiRecord.findFirst({
          where: { investorId: investor.id },
          orderBy: [
            {
              tanggal: "desc",
            },
            {
              createdAt: "desc",
            },
          ],
          select: { saldo_akhir: true },
        });

        const previousSaldo = lastTransaction
          ? Number(lastTransaction.saldo_akhir)
          : 0;

        const newSaldo = previousSaldo + nilaiMutasi; // KREDIT: add to saldo

        await prisma.mutasiRecord.create({
          data: {
            tanggal: threeMonthsLater,
            kode: investor.kode,
            nama: investor.nama,
            rekening_bank: investor.rekening_bank,
            mutasi: "KREDIT",
            nilai_mutasi: nilaiMutasi,
            saldo_akhir: newSaldo,
            keterangan: `Dana terpakai (${startOfCurrentMonth.toLocaleDateString(
              "id-ID",
              { month: "long", year: "numeric" },
            )})`,
            investorId: investor.id,
          },
        });

        console.log(
          `Dana terpakai processed for investor ${investor.kode}: ${nilaiMutasi}`,
        );
      }
    }

    return NextResponse.json({
      message: "Dana terpakai mutations processed successfully",
    });
  } catch (error) {
    console.error("Error processing dana terpakai mutations:", error);
    return NextResponse.json(
      { error: "Internal server error during dana terpakai processing" },
      { status: 500 },
    );
  }
}
