import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { kode } = await req.json();

    if (!kode) {
      return NextResponse.json(
        { error: "Kode investor wajib diisi" },
        { status: 400 },
      );
    }

    console.log("Fixing saldo for investor:", kode);

    // Cek koneksi database
    try {
      await prisma.$connect();
      console.log("Database connected successfully");
    } catch (connError) {
      console.error("Database connection failed:", connError);
      return NextResponse.json(
        { error: "Gagal terhubung ke database" },
        { status: 500 },
      );
    }

    // Gunakan raw query dengan tabel MutasiRecord
    try {
      // Ambil semua mutasi yang DISETUJUI dari tabel MutasiRecord
      console.log("Fetching from MutasiRecord with raw query...");
      const mutasiRecords = await prisma.$queryRaw`
        SELECT * FROM "MutasiRecord" 
        WHERE kode = ${kode} 
        AND status = 'DISETUJUI' 
        ORDER BY tanggal ASC
      `;

      const records = mutasiRecords as any[];
      console.log(`Found ${records.length} MutasiRecord records`);

      // Hitung ulang saldo dari MutasiRecord
      let saldo = 0;
      let totalKredit = 0;
      let totalDebet = 0;

      for (const record of records) {
        const nilaiMutasi = Number(record.nilai_mutasi) || 0;
        if (record.mutasi === "KREDIT") {
          saldo += nilaiMutasi;
          totalKredit += nilaiMutasi;
        } else if (record.mutasi === "DEBET") {
          saldo -= nilaiMutasi;
          totalDebet += nilaiMutasi;
        }
      }

      console.log("Perhitungan saldo:", {
        totalKredit,
        totalDebet,
        saldoHasil: saldo,
        jumlahTransaksi: records.length,
      });

      // Ambil data investment lama
      let oldInvestment = null;
      try {
        const oldData = await prisma.$queryRaw`
          SELECT * FROM "Investment" WHERE kode = ${kode}
        `;
        oldInvestment = (oldData as any[])[0];
      } catch (e) {
        console.log("No existing Investment found");
      }

      // Update atau insert Investment
      if (oldInvestment) {
        await prisma.$executeRaw`
          UPDATE "Investment" 
          SET dana_terpakai = ${totalDebet}, 
              saldo_akhir = ${saldo}, 
              updated_at = CURRENT_TIMESTAMP
          WHERE kode = ${kode}
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "Investment" (kode, dana_terpakai, saldo_akhir, bagi_hasil, updated_at)
          VALUES (${kode}, ${totalDebet}, ${saldo}, 0, CURRENT_TIMESTAMP)
        `;
      }

      // Ambil data yang sudah diupdate
      const updatedData = await prisma.$queryRaw`
        SELECT * FROM "Investment" WHERE kode = ${kode}
      `;
      const updatedInvestment = (updatedData as any[])[0];

      return NextResponse.json({
        message: "Saldo berhasil diperbaiki",
        data: updatedInvestment,
        oldSaldo: oldInvestment?.saldo_akhir || 0,
        newSaldo: saldo,
        totalKredit,
        totalDebet,
        historyCount: records.length,
      });
    } catch (dbError) {
      console.error("Database error:", dbError);

      // Coba tanpa petik ganda untuk tabel
      try {
        console.log("Trying without quotes...");
        const mutasiRecords = await prisma.$queryRaw`
          SELECT * FROM MutasiRecord 
          WHERE kode = ${kode} 
          AND status = 'DISETUJUI' 
          ORDER BY tanggal ASC
        `;

        const records = mutasiRecords as any[];

        let saldo = 0;
        let totalKredit = 0;
        let totalDebet = 0;

        for (const record of records) {
          const nilaiMutasi = Number(record.nilai_mutasi) || 0;
          if (record.mutasi === "KREDIT") {
            saldo += nilaiMutasi;
            totalKredit += nilaiMutasi;
          } else if (record.mutasi === "DEBET") {
            saldo -= nilaiMutasi;
            totalDebet += nilaiMutasi;
          }
        }

        // Update investment
        await prisma.$executeRaw`
          UPDATE Investment 
          SET dana_terpakai = ${totalDebet}, 
              saldo_akhir = ${saldo}, 
              updated_at = CURRENT_TIMESTAMP
          WHERE kode = ${kode}
        `;

        return NextResponse.json({
          message: "Saldo berhasil diperbaiki (tanpa quotes)",
          newSaldo: saldo,
          totalKredit,
          totalDebet,
          historyCount: records.length,
        });
      } catch (secondError) {
        console.error("Second attempt also failed:", secondError);

        return NextResponse.json(
          {
            error: "Gagal mengakses tabel MutasiRecord",
            details:
              dbError instanceof Error ? dbError.message : "Unknown error",
            secondError:
              secondError instanceof Error
                ? secondError.message
                : "Unknown error",
          },
          { status: 500 },
        );
      }
    }
  } catch (error) {
    console.error("Error fixing saldo:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
