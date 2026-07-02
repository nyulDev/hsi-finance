import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  const timerLabel = `GET /api/history:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  console.time(timerLabel);
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const action = searchParams.get("action");
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    if (action === "recent") {
      // Get recent transactions (last 7 days)
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentRecords = await prisma.mutasiRecord.findMany({
        where: {
          createdAt: {
            gte: oneWeekAgo,
          },
        },
        include: {
          investor: true,
        },
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
        take: 20, // Limit to 20 recent transactions
      });

      const formattedRecent = recentRecords.map((h) => ({
        ...h,
        nilai_mutasi: Number(h.nilai_mutasi),
        saldo_akhir: Number(h.saldo_akhir),
        saldo: Number(h.saldo_akhir),
        bukti_transfer: h.bukti_transfer,
      }));

      return NextResponse.json(formattedRecent);
    }

    if (action === "saldoByInvestor") {
      // Lightweight: fetch only fields needed for balance calculation
      const kodeParam = searchParams.get("kode");
      const whereClause: any = {};
      if (kodeParam) whereClause.kode = kodeParam;

      const records = await prisma.mutasiRecord.findMany({
        where: whereClause,
        select: {
          kode: true,
          mutasi: true,
          nilai_mutasi: true,
          admin1_status: true,
          admin2_status: true,
          tanggal: true,
          createdAt: true,
          id: true,
          // minimal fields — no investor join needed
          nama: true,
          rekening_bank: true,
          saldo_akhir: true,
          keterangan: true,
          bukti_transfer: true,
          investorId: true,
        },
        orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
      });

      return NextResponse.json(
        records.map((r) => ({
          ...r,
          nilai_mutasi: Number(r.nilai_mutasi),
          saldo_akhir: Number(r.saldo_akhir),
          investor: null,
        })),
      );
    }

    if (action === "currentSaldo") {
      // Calculate total current saldo using database aggregation
      const approvedTransactions = await prisma.mutasiRecord.findMany({
        where: {
          admin1_status: "APPROVE",
          admin2_status: "APPROVE",
        },
        select: {
          mutasi: true,
          nilai_mutasi: true,
          investorId: true,
        },
      });

      // Group by investor and calculate balance
      const balanceMap = new Map<string, number>();
      for (const transaction of approvedTransactions) {
        const current = balanceMap.get(transaction.investorId) || 0;
        if (transaction.mutasi === "KREDIT") {
          balanceMap.set(
            transaction.investorId,
            current + Number(transaction.nilai_mutasi),
          );
        } else if (transaction.mutasi === "DEBET") {
          balanceMap.set(
            transaction.investorId,
            current - Number(transaction.nilai_mutasi),
          );
        }
      }

      const totalSaldo = Array.from(balanceMap.values()).reduce(
        (sum, saldo) => sum + saldo,
        0,
      );
      return NextResponse.json({ totalSaldo });
    }

    // Default: paginated history records
    const searchParam = searchParams.get("search") || "";
    const kodeParam = searchParams.get("kode") || "";

    const whereClause: any = {};
    if (kodeParam) {
      whereClause.kode = kodeParam;
    }
    if (searchParam) {
      whereClause.OR = [
        { kode: { contains: searchParam, mode: "insensitive" } },
        { nama: { contains: searchParam, mode: "insensitive" } },
        { keterangan: { contains: searchParam, mode: "insensitive" } },
      ];
    }

    const [historyRecords, totalCount] = await Promise.all([
      prisma.mutasiRecord.findMany({
        where: whereClause,
        include: {
          investor: true,
        },
        orderBy: [
          { tanggal: "desc" },
          { createdAt: "desc" },
        ],
        take: limit,
        skip: skip,
      }),
      prisma.mutasiRecord.count({ where: whereClause }),
    ]);

    // Convert Decimal to number
    const formattedHistory = historyRecords.map((h) => ({
      ...h,
      nilai_mutasi: Number(h.nilai_mutasi),
      saldo_akhir: Number(h.saldo_akhir),
      saldo: Number(h.saldo_akhir),
      bukti_transfer: h.bukti_transfer,
    }));

    return NextResponse.json({
      data: formattedHistory,
      totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  } finally {
    console.timeEnd(timerLabel);
  }
}

export async function POST(request: NextRequest) {
  const timerLabel = `POST /api/history:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  console.time(timerLabel);
  try {
    const session = await auth();

    if (!session) {
      // Debug: bantu lacak kenapa auth() null
      const cookieHeader = request.headers.get("cookie") || "";
      const cookieNames = cookieHeader
        ? cookieHeader
            .split(";")
            .map((c) => c.split("=")[0]?.trim())
            .filter(Boolean)
        : [];

      // Debug secret environment availability (no values)
      console.error("[POST /api/history] auth secret env flags", {
        hasNEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
        hasAUTH_SECRET: !!process.env.AUTH_SECRET,
      });

      // Coba fallback: ambil token JWT langsung dari cookie session-token
      try {
        const token = await getToken({ req: request as any });
        console.error("[POST /api/history] auth() null but getToken()", {
          tokenPresent: !!token,
          tokenKeys: token ? Object.keys(token as any) : [],
        });
      } catch (e) {
        console.error("[POST /api/history] getToken() failed", {
          message: (e as Error)?.message,
        });
      }

      // Jangan log nilai cookie (sensitif). Hanya nama-nama cookie yang masuk.
      console.error("[POST /api/history] auth() returned null", {
        hasCookieHeader: cookieHeader.length > 0,
        cookieHeaderLength: cookieHeader.length,
        cookieNames,
        nextAuthCookieNamesDetected: cookieNames.filter((n) =>
          /next-auth|nextauth|session-token|authjs|__Secure-next-auth/i.test(n),
        ),
        hasAuthorizationHeader: !!request.headers.get("authorization"),
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
      });

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      tanggal,
      kode,
      nama,
      rekening_bank,
      mutasi,
      nilai_mutasi,
      saldo,
      keterangan,
      bukti_transfer,
    } = body;

    // PERBAIKAN: Enforce bukti_transfer for USER role ONLY for KREDIT transactions
    if (
      session.user.role === "USER" &&
      mutasi === "KREDIT" &&
      !bukti_transfer
    ) {
      return NextResponse.json(
        { error: "Bukti Transfer is required for setoran (KREDIT)." },
        { status: 400 },
      );
    }

    // Find investor by kode
    const investor = await prisma.investor.findFirst({
      where: { kode },
    });

    if (!investor) {
      return NextResponse.json(
        { error: "Investor not found" },
        { status: 400 },
      );
    }

    // Validasi saldo untuk transaksi DEBET
    if (mutasi === "DEBET") {
      // Hitung saldo yang tersedia (hanya transaksi yang sudah APPROVE)
      const approvedTransactions = await prisma.mutasiRecord.findMany({
        where: {
          investorId: investor.id,
          admin1_status: "APPROVE",
          admin2_status: "APPROVE",
        },
      });

      let availableBalance = 0;
      for (const transaction of approvedTransactions) {
        if (transaction.mutasi === "KREDIT") {
          availableBalance += Number(transaction.nilai_mutasi);
        } else if (transaction.mutasi === "DEBET") {
          availableBalance -= Number(transaction.nilai_mutasi);
        }
      }

      if (Number(nilai_mutasi) > availableBalance) {
        return NextResponse.json(
          { error: "Saldo tidak mencukupi untuk penarikan" },
          { status: 400 },
        );
      }
    }

    // Check if trying to DEBET and investor has active deposits (not matured)
    // Temporarily disabled
    /*
    if (mutasi === "DEBET") {
      // Check if the transaction date is the last day of the month
      const transactionDate = new Date(tanggal);
      const lastDayOfMonth = new Date(
        transactionDate.getFullYear(),
        transactionDate.getMonth() + 1,
        0
      );
      const isLastDayOfMonth =
        transactionDate.getDate() === lastDayOfMonth.getDate();

      if (!isLastDayOfMonth) {
        const activeDeposits = await prisma.deposit.findMany({
          where: {
            investorId: investor.id,
            status: "ACTIVE",
          },
        });

        if (activeDeposits.length > 0) {
          return NextResponse.json(
            {
              error:
                "Maaf Anda tidak dapat melakukan penarikan dikarenakan dana anda masih dalam jangka deposito",
            },
            { status: 400 }
          );
        }
      }
    }
    */

    const historyRecord = await prisma.mutasiRecord.create({
      data: {
        tanggal: new Date(tanggal),
        // Source of truth: investor by `kode`
        kode: investor.kode ?? kode,
        nama: investor.nama ?? nama,
        rekening_bank: investor.rekening_bank ?? rekening_bank,
        mutasi: mutasi as "DEBET" | "KREDIT",
        nilai_mutasi,
        saldo_akhir: 0, // Always start with 0, will be recalculated
        keterangan,
        bukti_transfer: bukti_transfer || null, // Pastikan null jika tidak ada
        admin1_status: "PROSES", // Ensure admin1_status is set to PROSES
        admin2_status: "PENDING", // Ensure admin2_status is set to PENDING
        investorId: investor.id,
      },
    });

    // Recalculate all saldo_akhir for this investor in chronological order
    // Only include APPROVED and SELESAI transactions in balance calculation
    const allTransactions = await prisma.mutasiRecord.findMany({
      where: { investorId: investor.id },
      orderBy: [
        {
          tanggal: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

    let currentSaldo = 0;
    for (const transaction of allTransactions) {
      // Only add to balance if both admins approved
      if (
        transaction.admin1_status === "APPROVE" &&
        transaction.admin2_status === "APPROVE"
      ) {
        if (transaction.mutasi === "KREDIT") {
          currentSaldo += Number(transaction.nilai_mutasi);
        } else if (transaction.mutasi === "DEBET") {
          currentSaldo -= Number(transaction.nilai_mutasi);
        }
      }

      // Set saldo_akhir to current balance after this transaction
      await prisma.mutasiRecord.update({
        where: { id: transaction.id },
        data: { saldo_akhir: currentSaldo },
      });
    }

    // Fetch the updated record
    const updatedRecord = await prisma.mutasiRecord.findUnique({
      where: { id: historyRecord.id },
      include: {
        investor: true,
      },
    });

    return NextResponse.json(
      {
        ...updatedRecord,
        nilai_mutasi: Number(updatedRecord?.nilai_mutasi),
        saldo_akhir: Number(updatedRecord?.saldo_akhir),
        saldo: Number(updatedRecord?.saldo_akhir),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating history record:", error);
    return NextResponse.json(
      { error: "Failed to create history record" },
      { status: 500 },
    );
  } finally {
    console.timeEnd(timerLabel);
  }
}
