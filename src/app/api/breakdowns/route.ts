import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const action = searchParams.get("action");

    if (action === "lastKode") {
      const lastBreakdown = await prisma.breakdown.findFirst({
        orderBy: {
          createdAt: "desc",
        },
        select: {
          kode: true,
        },
      });
      return NextResponse.json({ lastKode: lastBreakdown?.kode || null });
    }

    if (action === "totalCount") {
      const total = await prisma.breakdown.count();
      return NextResponse.json({ total });
    }

    const breakdowns = await prisma.breakdown.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(breakdowns);
  } catch (error) {
    console.error("Error fetching breakdowns:", error);
    return NextResponse.json(
      { error: "Failed to fetch breakdowns" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Request body:", JSON.stringify(body, null, 2));

    const {
      tanggal,
      project_pt,
      keterangan,
      nilai,
      tempo,
      bagi_hasil,
      hari,
      bagi_hasil_per_bulan,
    } = body;

    // Debug: Log each field individually
    console.log("=== DEBUG BREAKDOWN CREATE ===");
    console.log("tanggal:", tanggal, "type:", typeof tanggal);
    console.log("project_pt:", project_pt, "type:", typeof project_pt);
    console.log("nilai:", nilai, "type:", typeof nilai);
    console.log("tempo:", tempo, "type:", typeof tempo);
    console.log("bagi_hasil:", bagi_hasil, "type:", typeof bagi_hasil);
    console.log("hari:", hari, "type:", typeof hari);
    console.log(
      "bagi_hasil_per_bulan:",
      bagi_hasil_per_bulan,
      "type:",
      typeof bagi_hasil_per_bulan,
    );
    console.log("keterangan:", keterangan, "type:", typeof keterangan);

    // Validation
    if (!tanggal) {
      return NextResponse.json(
        { error: "Tanggal is required" },
        { status: 400 },
      );
    }
    if (!project_pt) {
      return NextResponse.json(
        { error: "Project PT is required" },
        { status: 400 },
      );
    }
    if (!nilai) {
      return NextResponse.json({ error: "Nilai is required" }, { status: 400 });
    }
    const nilaiNum = parseFloat(nilai);
    if (isNaN(nilaiNum)) {
      return NextResponse.json(
        { error: `Nilai must be a valid number, got: '${nilai}'` },
        { status: 400 },
      );
    }

    // Always generate a new kode server-side (ignore client-provided kode)
    // Use timestamp + random to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    let finalKode = `BRK-${timestamp}-${random}`;

    // Check if this kode already exists
    let existing = await prisma.breakdown.findUnique({
      where: { kode: finalKode },
      select: { kode: true },
    });

    // If exists, add more random digits
    let attempts = 0;
    while (existing && attempts < 10) {
      const newRandom = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
      finalKode = `BRK-${timestamp}-${newRandom}`;
      existing = await prisma.breakdown.findUnique({
        where: { kode: finalKode },
        select: { kode: true },
      });
      attempts++;
    }

    if (existing) {
      return NextResponse.json(
        { error: "Gagal membuat kode unik setelah 10 percobaan" },
        { status: 500 },
      );
    }

    console.log("Generated unique kode:", finalKode);

    console.log("Creating breakdown with:", {
      kode: finalKode,
      tanggal,
      project_pt,
      nilai,
    });

    const newBreakdown = await prisma.breakdown.create({
      data: {
        kode: finalKode,
        tanggal: new Date(tanggal),
        project_pt,
        keterangan,
        nilai: parseFloat(nilai),
        tempo: parseInt(tempo) || 60,
        bagi_hasil: parseFloat(bagi_hasil) || 0,
        hari: hari ? parseInt(hari) : null,
        bagi_hasil_per_bulan: bagi_hasil_per_bulan
          ? parseFloat(bagi_hasil_per_bulan)
          : null,
      },
    });

    console.log("Breakdown created successfully:", newBreakdown);
    return NextResponse.json(newBreakdown, { status: 201 });
  } catch (error) {
    console.error("Error creating breakdown:", error);
    return NextResponse.json(
      {
        error: `Failed to create breakdown: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
