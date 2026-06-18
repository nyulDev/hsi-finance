import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Note: Next.js provides `params` synchronously in Route Handlers.

export async function GET(
  request: Request,
  { params }: { params: { kode: string } },
) {
  try {
    const { kode } = params;

    // Query paling sederhana
    const result = await prisma.$queryRawUnsafe(`
      SELECT saldo_akhir FROM Investment WHERE kode = '${kode}'
    `);

    const data = (result as any[])[0];

    return NextResponse.json({
      saldo_akhir: data ? Number(data.saldo_akhir) : 0,
    });
  } catch (error) {
    // Return 0 jika error
    return NextResponse.json({ saldo_akhir: 0 });
  }
}
