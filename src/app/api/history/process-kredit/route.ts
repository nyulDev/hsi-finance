import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    let requestBody: any = {};
    try {
      requestBody = await request.json();
    } catch (e) {
      // Ignored, no body provided
    }

    const investors = await prisma.investor.findMany({
      select: {
        id: true,
        kode: true,
        nama: true,
        rekening_bank: true,
      },
    });

    const currentDate = new Date();

    const currentYear = requestBody.year !== undefined ? Number(requestBody.year) : currentDate.getFullYear();
    const currentMonth = requestBody.month !== undefined ? Number(requestBody.month) : currentDate.getMonth(); // 0-indexed

    // Tanggal transaksi = 3 bulan setelah bulan yang DIPILIH (bukan waktu server)
    // Contoh: pilih Juni (month=5) → threeMonthsLater = September (month=8)
    const threeMonthsLater = new Date(
      currentYear,
      currentMonth + 3,
      1,
    );

    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];

    const startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0);
    const endDate = new Date(currentYear, currentMonth, 8, 23, 59, 59);

    // Ambil semua transaksi APPROVE dalam rentang 1-8 bulan berjalan
    const allTransactions = await prisma.mutasiRecord.findMany({
      where: {
        admin2_status: "APPROVE",
        tanggal: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [
        { tanggal: "asc" },
        { id: "asc" },
      ],
      select: {
        investorId: true,
        saldo_akhir: true,
      },
    });

    // Ambil saldo_akhir terakhir per investor (persis investments page)
    const transactionsByInvestor = new Map<string, number>();
    for (const transaction of allTransactions) {
      // Karena diurutkan asc, yang terakhir menimpa yang sebelumnya
      transactionsByInvestor.set(
        transaction.investorId,
        Number(transaction.saldo_akhir),
      );
    }

    const saldoMap = new Map<string, number>();
    let totalSaldo = 0;

    // Investments page: loop ALL investors (no kode filter untuk totalSaldo)
    for (const investor of investors) {
      const saldo = transactionsByInvestor.get(investor.id) ?? 0;
      saldoMap.set(investor.id, saldo);
      totalSaldo += saldo;
    }

    console.log("totalSaldo (from investments logic):", totalSaldo);

    // ── Modal: gunakan filter month+year seperti investments page ──────
    // PENTING: jangan pakai prisma gte/lte untuk modal karena timezone UTC+7
    // menyebabkan tanggal akhir bulan (misal 30 Juni lokal = 29 Juni 17:00 UTC)
    // tidak ikut terhitung. Investments page memakai JS getMonth()/getFullYear()
    const allBreakdowns = await prisma.breakdown.findMany({
      select: { tanggal: true, nilai: true },
    });
    const filteredBreakdowns = allBreakdowns.filter((b) => {
      const d = new Date(b.tanggal);
      return d.getMonth() + 1 === currentMonth + 1 && d.getFullYear() === currentYear;
    });
    const modal = filteredBreakdowns.reduce((sum, b) => sum + Number(b.nilai), 0);

    // persenM persis seperti investments page
    const persenM =
      totalSaldo > 0 ? Math.min(100, (modal / totalSaldo) * 100) : 0;

    // Bagi Hasil: 5% of modal, deduct 5% admin fee (persis investments page)
    const bagiHasil = 0.05 * modal * 0.95;

    console.log("Profit Sharing Calculations:", { modal, totalSaldo, persenM, bagiHasil });

    // ── Ambil saldo_akhir terbaru per investor (untuk menghitung newSaldo) ──
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

    for (const investor of investors) {
      if (!investor.kode) continue;

      // Saldo dari snapshot investments (June 1-8)
      const saldo = saldoMap.get(investor.id) ?? 0;

      // persen dan bagi_hasil persis investments page
      const persen = totalSaldo > 0 ? (saldo / totalSaldo) * 100 : 0;
      const bagi_hasil = (persen / 100) * bagiHasil;
      const nilaiMutasi = bagi_hasil;

      console.log(
        `Investor ${investor.kode}: saldo=${saldo}, persen=${persen.toFixed(4)}%, bagi_hasil=${bagi_hasil}`,
      );

      if (nilaiMutasi > 0) {
        // Gunakan saldo_akhir terbaru (keseluruhan) sebagai dasar newSaldo
        const previousSaldo = latestSaldoMap.get(investor.id) || 0;
        const newSaldo = previousSaldo + nilaiMutasi;

        mutationsToCreate.push({
          tanggal: threeMonthsLater,
          kode: investor.kode,
          nama: investor.nama,
          rekening_bank: investor.rekening_bank,
          mutasi: "KREDIT",
          nilai_mutasi: nilaiMutasi,
          saldo_akhir: newSaldo,
          keterangan: `Profit Sharing (${monthNames[currentMonth]})`,
          investorId: investor.id,
        });
      }
    }

    if (mutationsToCreate.length > 0) {
      await prisma.mutasiRecord.createMany({
        data: mutationsToCreate,
      });
      console.log(
        `Successfully batch inserted ${mutationsToCreate.length} kredit mutations.`,
      );
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
