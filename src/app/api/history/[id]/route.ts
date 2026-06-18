import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { auth } from "../../../../lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const record = await prisma.mutasiRecord.findUnique({
      where: { id },
      include: {
        investor: true,
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error fetching history record:", error);
    return NextResponse.json(
      { error: "Failed to fetch history record" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      tanggal,
      kode,
      nama,
      rekening_bank,
      mutasi,
      nilai_mutasi,
      keterangan,
      bukti_transfer,
    } = body;

    // Check if the record exists
    const existingRecord = await prisma.mutasiRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Find investor by kode
    const investor = await prisma.investor.findFirst({
      where: { kode },
    });

    if (!investor) {
      return NextResponse.json(
        { error: "Investor not found" },
        { status: 404 },
      );
    }

    // Get all transactions for this investor ordered by date
    const allTransactions = await prisma.mutasiRecord.findMany({
      where: {
        investorId: investor.id,
      },
      orderBy: [
        {
          tanggal: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

    // Recalculate all saldo_akhir
    let currentSaldo = 0;
    for (const transaction of allTransactions) {
      if (transaction.id === id) {
        // Update the current transaction
        await prisma.mutasiRecord.update({
          where: { id },
          data: {
            tanggal: new Date(tanggal),
            kode,
            nama,
            rekening_bank,
            mutasi,
            nilai_mutasi: Number(nilai_mutasi),
            keterangan,
            bukti_transfer,
            investorId: investor.id,
          },
        });
        // Calculate saldo for this updated transaction only if both admins approved
        if (
          existingRecord.admin1_status === "APPROVE" &&
          existingRecord.admin2_status === "APPROVE"
        ) {
          if (mutasi === "KREDIT") {
            currentSaldo += Number(nilai_mutasi);
          } else if (mutasi === "DEBET") {
            currentSaldo -= Number(nilai_mutasi);
          }
        }
        await prisma.mutasiRecord.update({
          where: { id },
          data: { saldo_akhir: currentSaldo },
        });
      } else {
        // Calculate saldo for other transactions only if both admins approved
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
        await prisma.mutasiRecord.update({
          where: { id: transaction.id },
          data: { saldo_akhir: currentSaldo },
        });
      }
    }

    const updatedRecord = await prisma.mutasiRecord.findUnique({
      where: { id },
      include: {
        investor: true,
      },
    });

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error("Error updating history record:", error);
    return NextResponse.json(
      { error: "Failed to update history record" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    const { id } = await params;
    const body = await request.json();
    const { status, bukti_transfer } = body;

    // Check if the record exists
    const existingRecord = await prisma.mutasiRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    let updateData: any = {};

    // Two-step approval logic with separate admin statuses
    if (status === "APPROVE") {
      const isSuperAdmin = userRole === "SUPER_ADMIN";
      
      if ((userRole === "ADMIN1" || isSuperAdmin) && existingRecord.admin1_status === "PROSES") {
        updateData.admin1_status = "APPROVE";
        updateData.admin2_status = "PROSES"; // Move to Admin2 process
      } else if ((userRole === "ADMIN2" || isSuperAdmin) && (
        existingRecord.admin2_status === "PROSES" ||
        (existingRecord.mutasi === "DEBET" &&
          existingRecord.admin2_status === "PENDING")
      )) {
        updateData.admin2_status = "APPROVE";
        if (
          existingRecord.mutasi === "DEBET" &&
          existingRecord.admin1_status !== "APPROVE"
        ) {
          updateData.admin1_status = "APPROVE";
        }
      } else {
        return NextResponse.json(
          { error: "Invalid approval step or insufficient permissions" },
          { status: 403 },
        );
      }
    } else if (status === "REJECT") {
      if (userRole === "ADMIN1") {
        updateData.admin1_status = "REJECT";
        updateData.admin2_status = "REJECT"; // Reject immediately
      } else if (userRole === "ADMIN2") {
        updateData.admin2_status = "REJECT";
      } else if (userRole === "SUPER_ADMIN") {
        updateData.admin1_status = "REJECT";
        updateData.admin2_status = "REJECT"; // SUPER_ADMIN can reject at both levels
      } else {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 },
      );
    }

    // Update bukti_transfer if provided
    if (bukti_transfer) {
      updateData.bukti_transfer = bukti_transfer;
    }

    // Update the record
    const updatedRecord = await prisma.mutasiRecord.update({
      where: { id },
      data: updateData,
      include: {
        investor: true,
      },
    });

    // Recalculate saldo_akhir for all transactions of this investor
    const investorId = updatedRecord.investorId;
    const allTransactions = await prisma.mutasiRecord.findMany({
      where: {
        investorId,
      },
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

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error("Error updating history record status:", error);
    return NextResponse.json(
      { error: "Failed to update history record status" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Check if the record exists
    const record = await prisma.mutasiRecord.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Delete the record
    await prisma.mutasiRecord.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Record deleted successfully" });
  } catch (error) {
    console.error("Error deleting history record:", error);
    return NextResponse.json(
      { error: "Failed to delete history record" },
      { status: 500 },
    );
  }
}
