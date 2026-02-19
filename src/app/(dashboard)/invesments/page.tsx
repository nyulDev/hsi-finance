import { Investment } from "./columns";
import { prisma } from "@/lib/prisma";
import { InvestmentsClient } from "./invesments-client";

const months = [
  { name: "Januari", month: 1 },
  { name: "Februari", month: 2 },
  { name: "Maret", month: 3 },
  { name: "April", month: 4 },
  { name: "Mei", month: 5 },
  { name: "Juni", month: 6 },
  { name: "Juli", month: 7 },
  { name: "Agustus", month: 8 },
  { name: "September", month: 9 },
  { name: "Oktober", month: 10 },
  { name: "November", month: 11 },
  { name: "Desember", month: 12 },
];

const getData = async (
  month?: string,
): Promise<{
  investments: Investment[];
  modal: number;
  persenM: number;
  bagiHasil: number;
  persenB: number;
  adminFee: number;
  danaTersedia: number;
}> => {
  const investors = await prisma.investor.findMany({
    select: {
      id: true,
      kode: true,
      nama: true,
    },
  });

  // Sort investors by kode
  const sortedInvestors = [...investors].sort((a, b) => {
    const aKode = a.kode || "";
    const bKode = b.kode || "";

    const aParts = aKode.match(/^(\d{8})-(\d+)-([A-Z])$/);
    const bParts = bKode.match(/^(\d{8})-(\d+)-([A-Z])$/);

    if (aParts && bParts) {
      const [, aDate, aNum, aSuffix] = aParts;
      const [, bDate, bNum, bSuffix] = bParts;

      const numDiff = parseInt(aNum, 10) - parseInt(bNum, 10);
      if (numDiff !== 0) {
        return numDiff;
      }
      if (aSuffix !== bSuffix) {
        return aSuffix.localeCompare(bSuffix);
      }
      return aDate.localeCompare(bDate);
    }

    return aKode.localeCompare(bKode);
  });

  investors.length = 0;
  investors.push(...sortedInvestors);

  const saldoMap = new Map<string, number>();
  let totalSaldo = 0;

  // Calculate date range berdasarkan bulan yang dipilih
  let startDate: Date;
  let endDate: Date;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  if (month && month !== "all") {
    const monthNum = parseInt(month);

    // Cari tahun yang tepat dengan melihat data transaksi yang ada
    const latestTransactionInMonth = await prisma.mutasiRecord.findFirst({
      where: {
        admin2_status: "APPROVE",
        tanggal: {
          gte: new Date(currentYear - 2, monthNum - 1, 1),
          lte: new Date(currentYear, monthNum, 0),
        },
      },
      orderBy: {
        tanggal: "desc",
      },
      select: {
        tanggal: true,
      },
    });

    let targetYear = currentYear;
    if (latestTransactionInMonth) {
      targetYear = latestTransactionInMonth.tanggal.getFullYear();
    }

    startDate = new Date(targetYear, monthNum - 1, 1, 0, 0, 0);
    endDate = new Date(targetYear, monthNum - 1, 8, 23, 59, 59);
  } else if (month === "all") {
    startDate = new Date(2000, 0, 1);
    endDate = new Date();
  } else {
    const currentMonth = currentDate.getMonth();
    startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0);
    endDate = new Date(currentYear, currentMonth, 8, 23, 59, 59);
  }

  // Calculate modal dari ALL breakdowns di bulan yang dipilih (tanpa batasan tanggal)
  const breakdowns = await prisma.breakdown.findMany({
    select: {
      tanggal: true,
      nilai: true,
    },
  });

  let filteredBreakdowns = breakdowns;
  if (month && month !== "all") {
    const monthNum = parseInt(month);
    filteredBreakdowns = breakdowns.filter((d) => {
      const date = new Date(d.tanggal);
      return date.getMonth() + 1 === monthNum;
    });
  }

  const modalValue = filteredBreakdowns.reduce(
    (sum, b) => sum + Number(b.nilai),
    0,
  );

  // Ambil semua transaksi APPROVED untuk setiap investor di periode 1-8
  for (const investor of investors) {
    const transactions = await prisma.mutasiRecord.findMany({
      where: {
        investorId: investor.id,
        admin2_status: "APPROVE",
        tanggal: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [
        {
          tanggal: "asc",
        },
        {
          id: "asc",
        },
      ],
      select: {
        saldo_akhir: true,
      },
    });

    if (transactions.length > 0) {
      const lastTransaction = transactions[transactions.length - 1];
      const saldo = Number(lastTransaction.saldo_akhir);
      saldoMap.set(investor.id, saldo);
      totalSaldo += saldo;
    } else {
      saldoMap.set(investor.id, 0);
    }
  }

  const danaTersedia = totalSaldo;
  const modal = modalValue;

  const persenM =
    danaTersedia > 0 ? Math.min(100, (modal / danaTersedia) * 100) : 0;

  const bagiHasil = 0.05 * modal * 0.95;
  const adminFee = 0.05 * modal * 0.05;

  const persenB = modal > 0 ? (bagiHasil / modal) * 100 : 0;

  const investments = await Promise.all(
    investors.map(async (investor) => {
      const saldo = saldoMap.get(investor.id) || 0;
      const persen = totalSaldo > 0 ? (saldo / totalSaldo) * 100 : 0;
      const dana_terpakai = saldo * (persenM / 100);
      const bagi_hasil = (persen / 100) * bagiHasil;

      return {
        id: investor.id,
        kode: investor.kode,
        nama: investor.nama,
        saldo,
        persen,
        dana_terpakai,
        bagi_hasil,
      };
    }),
  );

  return {
    investments,
    modal,
    persenM,
    bagiHasil,
    persenB,
    adminFee,
    danaTersedia,
  };
};

const InvestmentsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) => {
  const { month } = await searchParams;
  const currentMonth = new Date().getMonth() + 1;
  const effectiveMonth = month || currentMonth.toString();
  const {
    investments,
    modal,
    persenM,
    bagiHasil,
    persenB,
    adminFee,
    danaTersedia,
  } = await getData(effectiveMonth);
  const monthName =
    months.find((m) => m.month === parseInt(effectiveMonth))?.name || null;

  return (
    <InvestmentsClient
      key={effectiveMonth}
      data={investments}
      modal={modal}
      persenM={persenM}
      bagiHasil={bagiHasil}
      persenB={persenB}
      adminFee={adminFee}
      danaTersedia={danaTersedia}
      month={month}
      monthName={monthName}
    />
  );
};

export default InvestmentsPage;
