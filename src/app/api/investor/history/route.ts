import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userKode = session.user.kode;

    if (!userKode) {
      return NextResponse.json(
        { error: "User kode not found" },
        { status: 400 },
      );
    }

    // Find investor by user kode
    const investor = await prisma.investor.findFirst({
      where: { kode: userKode },
    });

    if (!investor) {
      return NextResponse.json(
        { error: "Investor not found" },
        { status: 404 },
      );
    }

    // Get all mutasi records for this investor
    const historyRecords = await prisma.mutasiRecord.findMany({
      where: {
        investorId: investor.id,
      },
      orderBy: [
        {
          tanggal: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    // Calculate summary statistics
    const totalKredit = historyRecords
      .filter((record) => record.mutasi === "KREDIT")
      .reduce((sum, record) => sum + Number(record.nilai_mutasi), 0);

    const totalDebet = historyRecords
      .filter((record) => record.mutasi === "DEBET")
      .reduce((sum, record) => sum + Number(record.nilai_mutasi), 0);

    const currentSaldo =
      historyRecords.length > 0 ? Number(historyRecords[0].saldo_akhir) : 0;

    // Convert Decimal to number for client - explicitly convert enum to string
    const formattedHistory = historyRecords.map((h) => {
      // Get the raw values from Prisma enum
      const admin1Val = h.admin1_status;
      const admin2Val = h.admin2_status;

      // Convert to string explicitly
      const admin1StatusStr = admin1Val ? String(admin1Val) : "PROSES";
      const admin2StatusStr = admin2Val ? String(admin2Val) : "PENDING";

      return {
        id: h.id,
        tanggal: h.tanggal,
        kode: h.kode,
        nama: h.nama,
        rekening_bank: h.rekening_bank,
        mutasi: h.mutasi,
        nilai_mutasi: Number(h.nilai_mutasi),
        saldo_akhir: Number(h.saldo_akhir),
        keterangan: h.keterangan,
        bukti_transfer: h.bukti_transfer,
        admin1_status: admin1StatusStr,
        admin2_status: admin2StatusStr,
      };
    });

    const response = NextResponse.json({
      investor: {
        nama: investor.nama,
        kode: investor.kode,
        rekening_bank: investor.rekening_bank,
        atas_nama_rekening: investor.atas_nama_rekening,
        whatsapp: investor.whatsapp,
        email: investor.email,
      },
      summary: {
        currentSaldo,
        totalKredit,
        totalDebet,
        transactionCount: historyRecords.length,
      },
      transactions: formattedHistory,
    });

    // Add cache-control headers to prevent caching
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error("Error fetching investor history:", error);
    return NextResponse.json(
      { error: "Failed to fetch investor history" },
      { status: 500 },
    );
  }
}
