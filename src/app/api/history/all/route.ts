import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Hanya admin yang boleh akses semua transaksi
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN" &&
      userRole !== "ADMIN1" &&
      userRole !== "ADMIN2"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const page = searchParams.get("page");

    // Ambil semua transaksi tanpa filter investor
    const take = limit ? parseInt(limit) : 1000; // Default 1000, bisa diubah
    const skip = page ? (parseInt(page) - 1) * take : 0;

    const transactions = await prisma.mutasiRecord.findMany({
      include: {
        investor: true, // Include data investor
      },
      orderBy: [
        {
          tanggal: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take,
      skip,
    });

    // Hitung total untuk pagination
    const total = await prisma.mutasiRecord.count();

    // Format data untuk client
    const formattedTransactions = transactions.map((t) => ({
      id: t.id,
      tanggal: t.tanggal,
      kode: t.kode,
      nama: t.nama,
      rekening_bank: t.rekening_bank,
      mutasi: t.mutasi,
      nilai_mutasi: Number(t.nilai_mutasi),
      saldo_akhir: Number(t.saldo_akhir),
      keterangan: t.keterangan,
      bukti_transfer: t.bukti_transfer,
      admin1_status: t.admin1_status ? String(t.admin1_status) : "PROSES",
      admin2_status: t.admin2_status ? String(t.admin2_status) : "PENDING",
      createdAt: t.createdAt,
      investor: t.investor
        ? {
            id: t.investor.id,
            kode: t.investor.kode,
            nama: t.investor.nama,
            role: (t.investor as any).role, // Role investor
          }
        : null,
    }));

    const response = NextResponse.json({
      transactions: formattedTransactions,
      total,
      page: page ? parseInt(page) : 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    });

    // No cache
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );

    return response;
  } catch (error) {
    console.error("Error fetching all transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}
