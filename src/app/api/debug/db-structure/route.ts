import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const result: any = {
      status: "checking",
      tables: {},
      errors: [],
    };

    // Cek tabel MutasiRecord
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='MutasiRecord'
      `;

      if ((tableExists as any[]).length > 0) {
        // Coba hitung rows
        const count = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM MutasiRecord
        `;
        result.tables.MutasiRecord = {
          exists: true,
          count: (count as any[])[0]?.count || 0,
        };

        // Cek struktur kolom
        const columns = await prisma.$queryRaw`
          PRAGMA table_info(MutasiRecord)
        `;
        result.MutasiRecord_columns = columns;
      } else {
        result.tables.MutasiRecord = {
          exists: false,
          count: 0,
        };
      }
    } catch (e) {
      result.tables.MutasiRecord = {
        exists: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
      result.errors.push(`Error checking MutasiRecord: ${e}`);
    }

    // Cek tabel Investment
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='Investment'
      `;

      if ((tableExists as any[]).length > 0) {
        const count = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM Investment
        `;
        result.tables.Investment = {
          exists: true,
          count: (count as any[])[0]?.count || 0,
        };
      } else {
        result.tables.Investment = {
          exists: false,
          count: 0,
        };
      }
    } catch (e) {
      result.tables.Investment = {
        exists: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
      result.errors.push(`Error checking Investment: ${e}`);
    }

    // Cek tabel Investor
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='Investor'
      `;

      if ((tableExists as any[]).length > 0) {
        const count = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM Investor
        `;
        result.tables.Investor = {
          exists: true,
          count: (count as any[])[0]?.count || 0,
        };
      } else {
        result.tables.Investor = {
          exists: false,
          count: 0,
        };
      }
    } catch (e) {
      result.tables.Investor = {
        exists: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
      result.errors.push(`Error checking Investor: ${e}`);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
