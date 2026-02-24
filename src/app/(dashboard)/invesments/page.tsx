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
  sisaDana: number;
}> => {
  // Get all investors in one query
  const investors = await prisma.investor.findMany({
    select: {
      id: true,
      kode: true,
      nama: true,
    },
    orderBy: {
      kode: "asc",
    },
  });

  // Calculate date range berdasarkan bulan yang dipilih
  let startDate: Date;
  let endDate: Date;
  let nextMonthStartDate: Date | null = null;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  let targetYear = currentYear;

  if (month && month !== "all") {
    const monthNum = parseInt(month);

    // Search the ENTIRE month (not just days 1-8) to find the latest transaction
    // This ensures we get the correct year even if there are no transactions in early days
    const latestTransactionInMonth = await prisma.mutasiRecord.findFirst({
      where: {
        admin2_status: "APPROVE",
        tanggal: {
          gte: new Date(currentYear - 2, monthNum - 1, 1),
          lte: new Date(currentYear, monthNum, 0, 23, 59, 59),
        },
      },
      orderBy: {
        tanggal: "desc",
      },
      select: {
        tanggal: true,
      },
    });

    // Also check for breakdowns in the same period to determine target year
    const latestBreakdownInMonth = await prisma.breakdown.findFirst({
      where: {
        tanggal: {
          gte: new Date(currentYear - 2, monthNum - 1, 1),
          lte: new Date(currentYear, monthNum, 0, 23, 59, 59),
        },
      },
      orderBy: {
        tanggal: "desc",
      },
      select: {
        tanggal: true,
      },
    });

    // Use the latest date from either transactions or breakdowns
    if (latestTransactionInMonth && latestBreakdownInMonth) {
      targetYear =
        latestTransactionInMonth.tanggal > latestBreakdownInMonth.tanggal
          ? latestTransactionInMonth.tanggal.getFullYear()
          : latestBreakdownInMonth.tanggal.getFullYear();
    } else if (latestTransactionInMonth) {
      targetYear = latestTransactionInMonth.tanggal.getFullYear();
    } else if (latestBreakdownInMonth) {
      targetYear = latestBreakdownInMonth.tanggal.getFullYear();
    }

    startDate = new Date(targetYear, monthNum - 1, 1, 0, 0, 0);
    endDate = new Date(targetYear, monthNum - 1, 8, 23, 59, 59);
    nextMonthStartDate = new Date(targetYear, monthNum - 1, 9, 0, 0, 0);
  } else if (month === "all") {
    startDate = new Date(2000, 0, 1);
    endDate = new Date();
  } else {
    const currentMonth = currentDate.getMonth();
    startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0);
    endDate = new Date(currentYear, currentMonth, 8, 23, 59, 59);
    nextMonthStartDate = new Date(currentYear, currentMonth, 9, 0, 0, 0);
  }

  // Calculate modal - get ALL breakdowns first
  const breakdowns = await prisma.breakdown.findMany({
    select: {
      tanggal: true,
      nilai: true,
    },
  });

  let modalValue = 0;

  if (month && month !== "all") {
    // Use CURRENT month's breakdown data (not previous month)
    const monthNum = parseInt(month);
    const searchMonthNum = monthNum;
    const searchYear = targetYear;

    const filteredBreakdowns = breakdowns.filter((d) => {
      const date = new Date(d.tanggal);
      const monthFromDate = date.getMonth() + 1;
      const yearFromDate = date.getFullYear();
      return monthFromDate === searchMonthNum && yearFromDate === searchYear;
    });

    modalValue = filteredBreakdowns.reduce(
      (sum, b) => sum + Number(b.nilai),
      0,
    );
  } else if (!month || month === "all") {
    // For "all" or current month view, use current month's modal
    const currentMonthNum = currentDate.getMonth() + 1;
    const filteredBreakdowns = breakdowns.filter((d) => {
      const date = new Date(d.tanggal);
      return date.getMonth() + 1 === currentMonthNum;
    });

    modalValue = filteredBreakdowns.reduce(
      (sum, b) => sum + Number(b.nilai),
      0,
    );
  }

  // Modal for Sisa Dana calculation - use same logic as modalValue
  let modalForSisaDana = 0;

  if (month && month !== "all") {
    const monthNum = parseInt(month);
    const searchMonthNum = monthNum;
    const searchYear = targetYear;

    const filteredBreakdowns = breakdowns.filter((d) => {
      const date = new Date(d.tanggal);
      return (
        date.getMonth() + 1 === searchMonthNum &&
        date.getFullYear() === searchYear
      );
    });

    modalForSisaDana = filteredBreakdowns.reduce(
      (sum, b) => sum + Number(b.nilai),
      0,
    );
  } else if (!month || month === "all") {
    // For "all" or current month view, use current month's modal
    const currentMonthNum = currentDate.getMonth() + 1;
    const filteredBreakdowns = breakdowns.filter((d) => {
      const date = new Date(d.tanggal);
      return date.getMonth() + 1 === currentMonthNum;
    });

    modalForSisaDana = filteredBreakdowns.reduce(
      (sum, b) => sum + Number(b.nilai),
      0,
    );
  }

  // OPTIMIZATION 1: Get all transactions
  const allTransactions = await prisma.mutasiRecord.findMany({
    where: {
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
      investorId: true,
      saldo_akhir: true,
      tanggal: true,
      id: true,
    },
  });

  // Group transactions by investor and get the last one
  const transactionsByInvestor = new Map<string, (typeof allTransactions)[0]>();

  for (const transaction of allTransactions) {
    // Since transactions are ordered by tanggal and id asc,
    // the last one for each investor will be the final state
    transactionsByInvestor.set(transaction.investorId, transaction);
  }

  // Calculate saldo for each investor
  const saldoMap = new Map<string, number>();
  let totalSaldo = 0;

  for (const investor of investors) {
    const lastTransaction = transactionsByInvestor.get(investor.id);
    const saldo = lastTransaction ? Number(lastTransaction.saldo_akhir) : 0;
    saldoMap.set(investor.id, saldo);
    totalSaldo += saldo;
  }

  const danaTersedia = totalSaldo;
  const modal = modalValue;

  const persenM =
    danaTersedia > 0 ? Math.min(100, (modal / danaTersedia) * 100) : 0;

  const bagiHasil = 0.05 * modal * 0.95;
  const adminFee = 0.05 * modal * 0.05;

  const persenB = modal > 0 ? (bagiHasil / modal) * 100 : 0;

  // OPTIMIZATION 2: Get next month's transactions in one query
  let danaTersediaBulanBerikutnya = 0;

  if (month && month !== "all") {
    const monthNum = parseInt(month);
    const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
    const nextMonthYear = monthNum === 12 ? targetYear + 1 : targetYear;

    // Get transactions for days 1-8 of the next month
    const nextMonthStart = new Date(
      nextMonthYear,
      nextMonthNum - 1,
      1,
      0,
      0,
      0,
    );
    const nextMonthEnd = new Date(
      nextMonthYear,
      nextMonthNum - 1,
      8,
      23,
      59,
      59,
    );

    const nextMonthTransactions = await prisma.mutasiRecord.findMany({
      where: {
        admin2_status: "APPROVE",
        tanggal: {
          gte: nextMonthStart,
          lte: nextMonthEnd,
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
        investorId: true,
        saldo_akhir: true,
      },
    });

    // Group by investor and get last transaction
    const nextMonthTransactionsByInvestor = new Map<string, number>();

    for (const transaction of nextMonthTransactions) {
      // Since ordered asc, last one will overwrite previous ones
      nextMonthTransactionsByInvestor.set(
        transaction.investorId,
        Number(transaction.saldo_akhir),
      );
    }

    // Sum up all final balances
    for (const saldo of nextMonthTransactionsByInvestor.values()) {
      danaTersediaBulanBerikutnya += saldo;
    }
  } else if (!month || month === "all") {
    // For current month view, get next month's data
    const currentMonthNum = currentDate.getMonth() + 1;
    const nextMonthNum = currentMonthNum === 12 ? 1 : currentMonthNum + 1;
    const nextMonthYear =
      currentMonthNum === 12 ? currentYear + 1 : currentYear;

    const nextMonthStart = new Date(
      nextMonthYear,
      nextMonthNum - 1,
      1,
      0,
      0,
      0,
    );
    const nextMonthEnd = new Date(
      nextMonthYear,
      nextMonthNum - 1,
      8,
      23,
      59,
      59,
    );

    const nextMonthTransactions = await prisma.mutasiRecord.findMany({
      where: {
        admin2_status: "APPROVE",
        tanggal: {
          gte: nextMonthStart,
          lte: nextMonthEnd,
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
        investorId: true,
        saldo_akhir: true,
      },
    });

    // Group by investor and get last transaction
    const nextMonthTransactionsByInvestor = new Map<string, number>();

    for (const transaction of nextMonthTransactions) {
      // Since ordered asc, last one will overwrite previous ones
      nextMonthTransactionsByInvestor.set(
        transaction.investorId,
        Number(transaction.saldo_akhir),
      );
    }

    // Sum up all final balances
    for (const saldo of nextMonthTransactionsByInvestor.values()) {
      danaTersediaBulanBerikutnya += saldo;
    }
  }

  const sisaDana =
    danaTersedia - modalForSisaDana + danaTersediaBulanBerikutnya;

  const investments = investors.map((investor) => {
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
  });

  return {
    investments,
    modal,
    persenM,
    bagiHasil,
    persenB,
    adminFee,
    danaTersedia,
    sisaDana,
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
    sisaDana,
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
      sisaDana={sisaDana}
      month={month}
      monthName={monthName}
    />
  );
};

export default InvestmentsPage;
