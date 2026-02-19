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
  saldo_akhir: number;
  firstTransactionDate: string;
}

export default function RekapPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const investorsRes = await fetch("/api/investors");
        const transactionsRes = await fetch("/api/history");

        if (investorsRes.ok && transactionsRes.ok) {
          const investorsData = await investorsRes.json();
          const transactionsData = await transactionsRes.json();
          setTransactions(transactionsData);

          // Hitung saldo dan tanggal transaksi pertama untuk setiap investor
          const balancePerInvestor = new Map<string, number>();
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
              let currentBalance = balancePerInvestor.get(kode) || 0;
              // Hanya hitung saldo untuk transaksi yang disetujui kedua admin
              if (
                t.admin1_status === "APPROVE" &&
                t.admin2_status === "APPROVE"
              ) {
                if (t.mutasi === "KREDIT") {
                  currentBalance += t.nilai_mutasi;
                } else if (t.mutasi === "DEBET") {
                  currentBalance -= t.nilai_mutasi;
                }
              }
              balancePerInvestor.set(kode, currentBalance);

              // Catat tanggal transaksi pertama
              if (!firstTransactionDatePerInvestor.has(kode)) {
                firstTransactionDatePerInvestor.set(kode, t.tanggal);
              }
            }
          });

          const investorSummaries: InvestorSummary[] = investorsData.map(
            (investor: any) => ({
              kode: investor.kode,
              nama: investor.nama,
              rekening_bank: investor.rekening_bank,
              whatsapp: investor.whatsapp,
              saldo_akhir: balancePerInvestor.get(investor.kode) || 0,
              firstTransactionDate:
                firstTransactionDatePerInvestor.get(investor.kode) || "",
            }),
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

  // Hitung statistik ringkasan - hanya dari transaksi yang sudah disetujui
  const calculateSummary = () => {
    // Filter hanya transaksi yang disetujui oleh kedua admin
    const approvedTransactions = transactions.filter(
      (t) => t.admin1_status === "APPROVE" && t.admin2_status === "APPROVE",
    );

    // Hitung total saldo dari transaksi yang disetujui
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

    return {
      transactionCount: approvedTransactions.length,
      currentSaldo: totalSaldo,
    };
  };

  const summary = calculateSummary();

  // Filter investor berdasarkan pencarian (kode dan nama saja) dan kecualikan yang memiliki saldo_akhir = 0
  const filteredInvestors = investors.filter(
    (investor) =>
      investor.saldo_akhir !== 0 &&
      (investor.kode?.toLowerCase().includes(searchText.toLowerCase()) ||
        investor.nama?.toLowerCase().includes(searchText.toLowerCase())),
  );

  // Urutkan investor berdasarkan kode: pertama berdasarkan nomor, kemudian huruf suffix, kemudian tanggal (YYYYMMDD)
  const sortedInvestors = [...filteredInvestors].sort((a, b) => {
    const aKode = a.kode || "";
    const bKode = b.kode || "";

    // Ekstrak bagian: format adalah DDMMYYYY-XXX-Z
    // Contoh: 01012022-001-A
    const aParts = aKode.match(/^(\d{8})-(\d+)-([A-Z])$/);
    const bParts = bKode.match(/^(\d{8})-(\d+)-([A-Z])$/);

    // Jika keduanya cocok dengan pola, gunakan pengurutan khusus
    if (aParts && bParts) {
      const [, aDate, aNum, aSuffix] = aParts;
      const [, bDate, bNum, bSuffix] = bParts;

      // Pertama bandingkan berdasarkan nomor
      const numDiff = parseInt(aNum, 10) - parseInt(bNum, 10);
      if (numDiff !== 0) {
        return numDiff;
      }
      // Kemudian berdasarkan huruf suffix
      if (aSuffix !== bSuffix) {
        return aSuffix.localeCompare(bSuffix);
      }
      // Kemudian berdasarkan tanggal
      return aDate.localeCompare(bDate);
    }

    // Fallback ke urutan alfabet jika pola tidak cocok
    return aKode.localeCompare(bKode);
  });

  // Logika Pagination
  const totalPages = Math.ceil(sortedInvestors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvestors = sortedInvestors.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Reset ke halaman pertama ketika pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8 px-4 py-2 bg-secondary rounded-md flex justify-center items-center">
          <h1 className="font-semibold">Rekap Investor</h1>
        </div>

        {/* Kartu Ringkasan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Saldo Terkini
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {new Intl.NumberFormat("id-ID", {
                  maximumFractionDigits: 0,
                }).format(summary.currentSaldo)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Transaksi
              </CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {summary.transactionCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Riwayat Transaksi */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari kode atau nama..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="flex items-center space-x-2">
                <ExportPdfButton
                  summary={summary}
                  investors={sortedInvestors}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Kode</th>
                    <th className="text-left py-3 px-4 font-medium">Nama</th>
                    <th className="text-right py-3 px-4 font-medium">
                      Saldo Akhir
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Rekening Bank
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      WhatsApp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvestors.map((investor) => (
                    <tr
                      key={investor.kode}
                      className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="py-3 px-4">{investor.kode}</td>
                      <td className="py-3 px-4">{investor.nama}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {new Intl.NumberFormat("id-ID", {
                          maximumFractionDigits: 0,
                        }).format(investor.saldo_akhir)}
                      </td>
                      <td className="py-3 px-4">{investor.rekening_bank}</td>
                      <td className="py-3 px-4">{investor.whatsapp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {paginatedInvestors.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchText
                    ? "Tidak ada investor yang cocok dengan pencarian"
                    : "Belum ada investor"}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Menampilkan {startIndex + 1} sampai{" "}
                  {Math.min(startIndex + itemsPerPage, sortedInvestors.length)}{" "}
                  dari {sortedInvestors.length} hasil
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
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
                  >
                    Selanjutnya
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
