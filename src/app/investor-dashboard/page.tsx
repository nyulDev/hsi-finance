"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Plus,
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
  bukti_transfer: string | null;
  admin1_status: "PROSES" | "APPROVE" | "REJECT";
  admin2_status: "PENDING" | "PROSES" | "APPROVE" | "REJECT";
}

interface Investor {
  nama: string;
  kode: string;
  rekening_bank: string;
  atas_nama_rekening: string;
  whatsapp: string;
  email: string;
}

interface Summary {
  currentSaldo: number;
  totalKredit: number;
  totalDebet: number;
  transactionCount: number;
}

interface ApiResponse {
  investor: Investor;
  summary: Summary;
  transactions: Transaction[];
}

export default function InvestorDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching investor history data...");
        // Add cache-busting query param
        const cacheBuster = new Date().getTime();
        const response = await fetch(`/api/investor/history?_=${cacheBuster}`);
        console.log("API response status:", response.status);
        if (response.ok) {
          const data = await response.json();
          console.log("Data loaded successfully:", data);
          setData(data);
        } else {
          console.error("Failed to fetch data, status:", response.status);
          const errorText = await response.text();
          console.error("Error response:", errorText);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredTransactions =
    data?.transactions.filter(
      (transaction) =>
        transaction.keterangan
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        transaction.tanggal.includes(searchText) ||
        transaction.mutasi.toLowerCase().includes(searchText.toLowerCase()),
    ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Data Tidak Ditemukan
          </h2>
          <p className="text-gray-600">
            Tidak dapat memuat data investor. Pastikan Anda sudah login.
          </p>
          <div className="mt-4">
            <Button onClick={() => window.location.reload()} variant="outline">
              Coba Lagi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dashboard Investor
          </h1>
          <p className="text-gray-600">Selamat datang, {data.investor.nama}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                  style: "currency",
                  currency: "IDR",
                }).format(data.summary.currentSaldo)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Kredit
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                }).format(data.summary.totalKredit)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Debet</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                }).format(data.summary.totalDebet)}
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
                {data.summary.transactionCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Investor Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Informasi Investor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Nama
                </label>
                <p className="text-lg font-semibold">{data.investor.nama}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Kode Investor
                </label>
                <p className="text-lg font-semibold">{data.investor.kode}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Email
                </label>
                <p className="text-lg font-semibold">{data.investor.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  No. Rekening
                </label>
                <p className="text-lg font-semibold">
                  {data.investor.rekening_bank}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Atas Nama
                </label>
                <p className="text-lg font-semibold">
                  {data.investor.atas_nama_rekening}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  WhatsApp
                </label>
                <p className="text-lg font-semibold">
                  {data.investor.whatsapp}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions History */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle>History Transaksi</CardTitle>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {data && (
                  <>
                    <ExportPdfButton
                      investor={data.investor}
                      transactions={data.transactions}
                    />
                    <span className="text-sm text-gray-500">
                      Button should appear here
                    </span>
                  </>
                )}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Cari transaksi..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Tanggal</th>
                    <th className="text-left py-3 px-4 font-medium">Jenis</th>
                    <th className="text-right py-3 px-4 font-medium">Nilai</th>
                    <th className="text-right py-3 px-4 font-medium">
                      Saldo Akhir
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Keterangan
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Bukti Transfer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        {new Date(transaction.tanggal).toLocaleDateString(
                          "id-ID",
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            transaction.mutasi === "KREDIT"
                              ? "default"
                              : "destructive"
                          }
                          className={
                            transaction.mutasi === "KREDIT"
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }
                        >
                          {transaction.mutasi}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        }).format(transaction.nilai_mutasi)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        }).format(transaction.saldo_akhir)}
                      </td>
                      <td className="py-3 px-4">{transaction.keterangan}</td>
                      <td className="py-3 px-4">
                        {transaction.bukti_transfer ? (
                          <a
                            href={transaction.bukti_transfer}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Lihat
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTransactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchText
                    ? "Tidak ada transaksi yang cocok dengan pencarian"
                    : "Belum ada transaksi"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
