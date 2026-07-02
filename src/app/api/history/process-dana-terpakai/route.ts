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

    const startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0);
    const endDate = new Date(currentYear, currentMonth, 8, 23, 59, 59);

    // Ambil semua transaksi yang APPROVE dalam rentang 1-8 bulan berjalan
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

    // Ambil saldo_akhir transaksi terakhir per investor (persis seperti investments page)
    const transactionsByInvestor = new Map<string, number>();
    for (const transaction of allTransactions) {
      // Karena diurutkan asc, yang terakhir akan menimpa yang sebelumnya
      transactionsByInvestor.set(
        transaction.investorId,
        Number(transaction.saldo_akhir),
      );
    }

    const saldoMap = new Map<string, number>();
    let totalSaldo = 0;

    for (const investor of investors) {
      if (!investor.kode) continue;
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
      // Gunakan waktu lokal (sama persis dengan investments page)
      return d.getMonth() + 1 === currentMonth + 1 && d.getFullYear() === currentYear;
    });
    const modal = filteredBreakdowns.reduce((sum, b) => sum + Number(b.nilai), 0);
    // Simpan startOfCurrentMonth untuk digunakan di keterangan mutasi
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);

    // persenM persis seperti investments page
    const persenM =
      totalSaldo > 0 ? Math.min(100, (modal / totalSaldo) * 100) : 0;

    console.log("Calculations:", {
      modal,
      totalSaldo,
      persenM,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    for (const investor of investors) {
      if (!investor.kode) continue;

      const saldo = saldoMap.get(investor.id) ?? 0;

      // dana_terpakai = saldo × (persenM / 100), persis investments page
      const dana_terpakai = saldo * (persenM / 100);
      const nilaiMutasi = dana_terpakai;

      console.log(`Investor ${investor.kode}: saldo=${saldo}, dana_terpakai=${dana_terpakai}`);

      if (nilaiMutasi > 0) {
        // Get last saldo for this investor
        const lastTransaction = await prisma.mutasiRecord.findFirst({
          where: { investorId: investor.id },
          orderBy: [
            { tanggal: "desc" },
            { createdAt: "desc" },
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
