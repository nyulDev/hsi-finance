"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Wallet,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { ExportPdfButton } from "./export-pdf-button";

interface Transaction {
  id: string;
  tanggal: string;
  kode: string;
  nama: string | null;
  rekening_bank: string | null;
  mutasi: "KREDIT" | "DEBET";
  nilai_mutasi: number;
  saldo_akhir: number;
  keterangan: string | null;
  createdAt: string;
  admin1_status: "PROSES" | "APPROVE" | "REJECT";
  admin2_status: "PENDING" | "PROSES" | "APPROVE" | "REJECT";
  investor: {
    id: string;
    nama: string | null;
    kode: string | null;
    rekening_bank: string | null;
    whatsapp: string | null;
  };
}

interface InvestorSummary {
  kode: string;
  nama: string | null;
  rekening_bank: string | null;
  whatsapp: string | null;
  saldo: number;
  dana_ditahan: number;
  saldo_akhir_calculated: number;
  firstTransactionDate: string;
}

export default function RekapPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const itemsPerPage = 20; // DIUBAH DARI 10 MENJADI 20

  useEffect(() => {
    const fetchData = async () => {
      try {
        const investorsRes = await fetch("/api/investors");
        const transactionsRes = await fetch("/api/history");

        if (investorsRes.ok && transactionsRes.ok) {
          const investorsData = await investorsRes.json();
          const transactionsData = await transactionsRes.json();
          setTransactions(transactionsData);

          const saldoPerInvestor = new Map<string, number>();
          const danaDitahanPerInvestor = new Map<string, number>();
          const firstTransactionDatePerInvestor = new Map<string, string>();
          const sortedTransactions = [...transactionsData].sort((a, b) => {
            const dateA = new Date(a.tanggal);
            const dateB = new Date(b.tanggal);
            if (dateA.getTime() !== dateB.getTime()) {
              return dateA.getTime() - dateB.getTime();
            }
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });

          sortedTransactions.forEach((t) => {
            if (t.investor?.kode) {
              const kode = t.investor.kode;

              if (!firstTransactionDatePerInvestor.has(kode)) {
                firstTransactionDatePerInvestor.set(kode, t.tanggal);
              }

              const currentSaldo = saldoPerInvestor.get(kode) || 0;
              const currentDanaDitahan = danaDitahanPerInvestor.get(kode) || 0;

              const isApproved =
                t.admin1_status === "APPROVE" && t.admin2_status === "APPROVE";

              if (isApproved) {
                if (t.mutasi === "KREDIT") {
                  saldoPerInvestor.set(kode, currentSaldo + t.nilai_mutasi);
                } else if (t.mutasi === "DEBET") {
                  saldoPerInvestor.set(kode, currentSaldo - t.nilai_mutasi);
                }
              } else if (
                t.admin1_status !== "REJECT" &&
                t.admin2_status !== "REJECT"
              ) {
                if (t.mutasi === "KREDIT") {
                  danaDitahanPerInvestor.set(
                    kode,
                    currentDanaDitahan + t.nilai_mutasi,
                  );
                } else if (t.mutasi === "DEBET") {
                  danaDitahanPerInvestor.set(
                    kode,
                    currentDanaDitahan - t.nilai_mutasi,
                  );
                }
              }
            }
          });

          const investorSummaries: InvestorSummary[] = investorsData.map(
            (investor: any) => {
              const kode = investor.kode;
              const saldo = saldoPerInvestor.get(kode) || 0;
              const danaDitahan = danaDitahanPerInvestor.get(kode) || 0;

              return {
                kode: kode,
                nama: investor.nama,
                rekening_bank: investor.rekening_bank,
                whatsapp: investor.whatsapp,
                saldo: saldo,
                dana_ditahan: danaDitahan,
                saldo_akhir_calculated: saldo + danaDitahan,
                firstTransactionDate:
                  firstTransactionDatePerInvestor.get(kode) || "",
              };
            },
          );

          setInvestors(investorSummaries);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateSummary = () => {
    const approvedTransactions = transactions.filter(
      (t) => t.admin1_status === "APPROVE" && t.admin2_status === "APPROVE",
    );

    let totalSaldo = 0;
    const balancePerInvestor = new Map<string, number>();
    const sortedTransactions = [...approvedTransactions].sort((a, b) => {
      const dateA = new Date(a.tanggal);
      const dateB = new Date(b.tanggal);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    sortedTransactions.forEach((t) => {
      if (t.investor?.kode) {
        const kode = t.investor.kode;
        let currentBalance = balancePerInvestor.get(kode) || 0;
        if (t.mutasi === "KREDIT") {
          currentBalance += t.nilai_mutasi;
        } else if (t.mutasi === "DEBET") {
          currentBalance -= t.nilai_mutasi;
        }
        balancePerInvestor.set(kode, currentBalance);
      }
    });

    totalSaldo = Array.from(balancePerInvestor.values()).reduce(
      (sum, saldo) => sum + saldo,
      0,
    );

    const totalDanaDitahan = investors.reduce(
      (sum, inv) => sum + (inv.dana_ditahan || 0),
      0,
    );

    return {
      transactionCount: approvedTransactions.length,
      currentSaldo: totalSaldo,
      totalDanaDitahan: totalDanaDitahan,
      totalInvestorSaldo: totalSaldo + totalDanaDitahan,
    };
  };

  const summary = calculateSummary();

  const filteredInvestors = investors.filter(
    (investor) =>
      (showZeroBalance || investor.saldo_akhir_calculated !== 0) &&
      (investor.kode?.toLowerCase().includes(searchText.toLowerCase()) ||
        investor.nama?.toLowerCase().includes(searchText.toLowerCase())),
  );

  const sortedInvestors = [...filteredInvestors].sort((a, b) => {
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

  const totalPages = Math.ceil(sortedInvestors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvestors = sortedInvestors.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, showZeroBalance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6 px-4 py-2 bg-white rounded-md shadow-sm flex justify-center items-center">
          <h1 className="font-semibold text-lg">Rekap Investor</h1>
        </div>

        {/* Kartu Ringkasan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Saldo Tersedia
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {new Intl.NumberFormat("id-ID", {
                  maximumFractionDigits: 0,
                }).format(summary.currentSaldo)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Transaksi approved
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Dana Ditahan
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {new Intl.NumberFormat("id-ID", {
                  maximumFractionDigits: 0,
                }).format(summary.totalDanaDitahan)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Transaksi pending
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Saldo</CardTitle>
              <Receipt className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {new Intl.NumberFormat("id-ID", {
                  maximumFractionDigits: 0,
                }).format(summary.totalInvestorSaldo)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.transactionCount} transaksi
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabel Investor */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center w-full sm:w-auto">
                  <Search className="h-4 w-4 text-gray-400 mr-2" />
                  <Input
                    placeholder="Cari kode/nama..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full sm:w-64 h-9"
                  />
                </div>
                <Button
                  variant={showZeroBalance ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowZeroBalance(!showZeroBalance)}
                  className="whitespace-nowrap h-9"
                >
                  {showZeroBalance ? "Semua Investor" : "Sembunyikan Saldo 0"}
                </Button>
              </div>
              <ExportPdfButton summary={summary} investors={sortedInvestors} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-y bg-gray-50">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Kode
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Nama
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Saldo Tersedia
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wider bg-amber-50">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3 text-amber-500" />
                        Dana Ditahan
                      </span>
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wider bg-purple-50">
                      Total Saldo
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Rekening
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wider">
                      WA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvestors.map((investor, index) => (
                    <tr
                      key={investor.kode}
                      className={`border-b hover:bg-gray-50 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="py-2 px-3 text-sm">{investor.kode}</td>
                      <td className="py-2 px-3 text-sm">{investor.nama}</td>
                      <td className="py-2 px-3 text-sm text-right font-medium text-blue-600">
                        {new Intl.NumberFormat("id-ID", {
                          maximumFractionDigits: 0,
                        }).format(investor.saldo)}
                      </td>
                      <td className="py-2 px-3 text-sm text-right font-medium text-amber-600 bg-amber-50/30">
                        {investor.dana_ditahan > 0 ? (
                          new Intl.NumberFormat("id-ID", {
                            maximumFractionDigits: 0,
                          }).format(investor.dana_ditahan)
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-sm text-right font-bold text-purple-600 bg-purple-50/30">
                        {new Intl.NumberFormat("id-ID", {
                          maximumFractionDigits: 0,
                        }).format(investor.saldo_akhir_calculated)}
                      </td>
                      <td className="py-2 px-3 text-sm">
                        {investor.rekening_bank || "-"}
                      </td>
                      <td className="py-2 px-3 text-sm">
                        {investor.whatsapp || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {paginatedInvestors.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchText
                    ? "Tidak ada investor yang cocok"
                    : "Belum ada investor"}
                </div>
              )}
            </div>

            {/* Pagination - Disesuaikan untuk 20 data per halaman */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-3 border-t">
                <div className="text-xs text-gray-500">
                  Menampilkan {startIndex + 1} -{" "}
                  {Math.min(startIndex + itemsPerPage, sortedInvestors.length)}{" "}
                  dari {sortedInvestors.length} investor
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-8 px-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Sebelumnya
                  </Button>
                  <span className="text-sm">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-8 px-2"
                  >
                    Selanjutnya
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Informasi tambahan jika total hangan lebih dari 1 halaman */}
            {sortedInvestors.length > itemsPerPage && (
              <div className="px-3 py-2 text-xs text-gray-400 border-t">
                *Menampilkan 20 data per halaman. Total {sortedInvestors.length}{" "}
                investor.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
