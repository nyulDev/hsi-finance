"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Plus, RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  tanggal: z.date({
    required_error: "Tanggal wajib diisi",
  }),
  kode: z.string().min(1, "Kode investor wajib diisi"),
  nama: z.string().min(1, "Nama investor wajib diisi"),
  rekening_bank: z.string().optional(),
  mutasi: z.enum(["KREDIT", "DEBET"], {
    required_error: "Jenis mutasi wajib dipilih",
  }),
  nilai_mutasi: z
    .number({
      required_error: "Nilai mutasi wajib diisi",
      invalid_type_error: "Nilai mutasi harus berupa angka",
    })
    .min(1, "Nilai mutasi harus lebih dari 0"),
  keterangan: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Investor {
  kode: string | null;
  nama: string | null;
  rekening_bank: string | null;
  whatsapp: string | null;
}

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

interface AddMutasiDialogProps {
  onSuccess: () => void;
  isUserMode?: boolean;
  userKode?: string;
  disabled?: boolean;
}

export function AddMutasiDialog({
  onSuccess,
  isUserMode = false,
  userKode,
  disabled = false,
}: AddMutasiDialogProps) {
  const [open, setOpen] = useState(false);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [buktiTransferFile, setBuktiTransferFile] = useState<File | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [saldoWarning, setSaldoWarning] = useState<string | null>(null);
  const [investorSaldo, setInvestorSaldo] = useState<number | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tanggal: new Date(),
      kode: "",
      nama: "",
      rekening_bank: "",
      mutasi: "KREDIT",
      nilai_mutasi: 0,
      keterangan: "",
    },
  });

  // Watch values untuk reactive updates
  const tanggalValue = watch("tanggal");
  const kodeValue = watch("kode");
  const mutasiValue = watch("mutasi");
  const nilaiMutasi = watch("nilai_mutasi");

  // Fungsi untuk menghitung saldo investor berdasarkan transaksi yang APPROVE
  const calculateInvestorBalance = useCallback(
    (investorKode: string, allTransactions: Transaction[]) => {
      // Filter transaksi untuk investor tertentu yang sudah di-approve kedua admin
      const investorTransactions = allTransactions.filter(
        (t) =>
          t.kode === investorKode &&
          t.admin1_status === "APPROVE" &&
          t.admin2_status === "APPROVE",
      );

      // Urutkan transaksi berdasarkan tanggal dan createdAt
      const sortedTransactions = [...investorTransactions].sort((a, b) => {
        const dateA = new Date(a.tanggal);
        const dateB = new Date(b.tanggal);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      // Hitung saldo
      let balance = 0;
      sortedTransactions.forEach((t) => {
        if (t.mutasi === "KREDIT") {
          balance += t.nilai_mutasi;
        } else if (t.mutasi === "DEBET") {
          balance -= t.nilai_mutasi;
        }
      });

      console.log(`Calculated balance for ${investorKode}:`, balance);
      return balance;
    },
    [],
  );

  // Fungsi untuk mengambil data
  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    setInputError(null);
    try {
      console.log("[AddMutasi] Fetching investors and history...");

      // Fetch investors dan transactions secara terpisah agar jika salah satu gagal
      // yang lain tetap bisa ditampilkan
      const [investorsRes, transactionsRes] = await Promise.all([
        fetch("/api/investors"),
        fetch("/api/history"),
      ]);

      console.log("[AddMutasi] investorsRes.status:", investorsRes.status);
      console.log("[AddMutasi] transactionsRes.status:", transactionsRes.status);

      // Handle investors - WAJIB berhasil untuk dropdown
      if (investorsRes.ok) {
        const investorsData = await investorsRes.json();
        console.log("[AddMutasi] Investors loaded:", investorsData?.length, "items", investorsData);
        setInvestors(Array.isArray(investorsData) ? investorsData : []);

        // Jika dalam user mode, set data investor dari userKode
        if (isUserMode && userKode) {
          const investor = investorsData.find(
            (inv: Investor) => inv.kode === userKode,
          );
          if (investor) {
            setValue("kode", investor.kode || "");
            setValue("nama", investor.nama || "");
            setValue("rekening_bank", investor.rekening_bank || "");
          }
        }
      } else {
        const errText = await investorsRes.text();
        console.error("[AddMutasi] Investors fetch FAILED:", investorsRes.status, errText);
        setInputError(`Gagal memuat data investor (${investorsRes.status}). Silakan coba lagi.`);
      }

      // Handle transactions - opsional, hanya untuk hitung saldo
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        console.log("[AddMutasi] Transactions loaded:", transactionsData?.length, "items");
        setTransactions(Array.isArray(transactionsData) ? transactionsData : []);

        if (isUserMode && userKode) {
          const balance = calculateInvestorBalance(userKode, transactionsData);
          setInvestorSaldo(balance);
        }
      } else {
        console.warn("[AddMutasi] Transactions fetch failed:", transactionsRes.status);
        // Tidak error fatal, saldo tidak akan dihitung
      }
    } catch (error) {
      console.error("[AddMutasi] Error fetching data:", error);
      setInputError("Gagal mengambil data. Silakan coba lagi.");
    } finally {
      setIsLoadingData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserMode, userKode, setValue, calculateInvestorBalance]);

  // Fungsi untuk refresh data saat dialog dibuka
  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Refresh data setiap kali dialog dibuka
  useEffect(() => {
    if (open) {
      refreshData();
    }
  }, [open, refreshData]);

  // Efek untuk validasi saldo real-time
  useEffect(() => {
    if (mutasiValue === "DEBET" && investorSaldo !== null && nilaiMutasi > 0) {
      if (nilaiMutasi > investorSaldo) {
        setSaldoWarning(
          `⚠️ Saldo tidak cukup! Maksimal penarikan: Rp ${investorSaldo.toLocaleString("id-ID")}`,
        );
      } else {
        setSaldoWarning(null);
      }
    }
  }, [mutasiValue, nilaiMutasi, investorSaldo]);

  // Saat investor dipilih (mode admin)
  const handleInvestorSelect = (investorKode: string) => {
    const investor = investors.find((inv) => inv.kode === investorKode);
    if (investor) {
      setValue("kode", investor.kode || "");
      setValue("nama", investor.nama || "");
      setValue("rekening_bank", investor.rekening_bank || "");

      // Hitung saldo untuk investor yang dipilih
      const balance = calculateInvestorBalance(investorKode, transactions);
      setInvestorSaldo(balance);
    }
  };

  // Handle input nilai mutasi dengan validasi
  const handleNilaiMutasiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");

    if (value === "") {
      setValue("nilai_mutasi", 0);
      setInputError(null);
      return;
    }

    const numValue = parseInt(value, 10);

    if (isNaN(numValue)) {
      setInputError("Harap masukkan angka yang valid");
      return;
    }

    if (numValue > 1000000000) {
      setInputError("Nilai maksimal adalah Rp 1.000.000.000");
      return;
    }

    setValue("nilai_mutasi", numValue);
    setInputError(null);
  };

  // Format angka untuk ditampilkan
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("id-ID").format(num);
  };

  const onSubmit = async (data: FormData) => {
    // Validasi input
    if (data.nilai_mutasi <= 0) {
      setInputError("Nilai mutasi harus lebih dari 0");
      return;
    }

    // Validasi bukti transfer untuk KREDIT (SETORAN)
    if (isUserMode && data.mutasi === "KREDIT" && !buktiTransferFile) {
      alert("Bukti Transfer wajib diisi untuk transaksi setoran (KREDIT).");
      return;
    }

    // Validasi saldo untuk DEBET
    if (
      data.mutasi === "DEBET" &&
      investorSaldo !== null &&
      data.nilai_mutasi > investorSaldo
    ) {
      alert(
        `Maaf Saldo Anda Tidak Cukup. Saldo tersedia: Rp ${investorSaldo.toLocaleString("id-ID")}`,
      );
      return;
    }

    setLoading(true);
    try {
      let buktiTransferUrl = "";

      // Upload file if exists
      if (buktiTransferFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", buktiTransferFile);
        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formDataUpload,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          buktiTransferUrl = uploadData.url;
        } else {
          alert("Gagal mengupload file");
          setLoading(false);
          return;
        }
      }

      const payload = {
        tanggal: format(data.tanggal, "yyyy-MM-dd"),
        kode: data.kode,
        nama: data.nama,
        rekening_bank: data.rekening_bank || "",
        mutasi: data.mutasi,
        nilai_mutasi: data.nilai_mutasi,
        keterangan: data.keterangan || "",
        bukti_transfer: buktiTransferUrl,
        status: "PROSES",
      };

      console.log("Submitting mutasi:", payload);

      const res = await fetch("/api/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setOpen(false);
        reset();
        setBuktiTransferFile(null);
        setInvestorSaldo(null);
        setSaldoWarning(null);
        setInputError(null);
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.error || "Gagal menambah mutasi");
      }
    } catch (error) {
      console.error("Error adding mutasi:", error);
      alert("Terjadi kesalahan saat menambah mutasi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Mutasi Baru</DialogTitle>
          <DialogDescription>
            Masukkan detail mutasi untuk investor.
          </DialogDescription>
        </DialogHeader>

        {/* Loading Overlay */}
        {isLoadingData && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50 rounded-lg">
            <div className="bg-white p-4 rounded-md shadow-lg flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <p className="text-sm">Memuat data...</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Field Tanggal */}
          <div className="space-y-2">
            <Label htmlFor="tanggal">Tanggal</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full pl-3 text-left font-normal",
                    !tanggalValue && "text-muted-foreground",
                  )}
                >
                  {tanggalValue ? (
                    format(tanggalValue, "PPP")
                  ) : (
                    <span>Pilih tanggal</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={tanggalValue}
                  onSelect={(date) => setValue("tanggal", date || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.tanggal && (
              <p className="text-sm text-red-500">{errors.tanggal.message}</p>
            )}
          </div>

          {/* Field Kode Investor */}
          <div className="space-y-2">
            <Label htmlFor="kode">Kode Investor</Label>
            {isUserMode ? (
              <Input
                id="kode"
                value={isLoadingData ? "Loading..." : watch("kode")}
                readOnly
                className="bg-gray-50"
              />
            ) : (
              <Select
                onValueChange={handleInvestorSelect}
                value={kodeValue || undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih investor" />
                </SelectTrigger>
                <SelectContent>
                  {investors.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-muted-foreground">
                      {isLoadingData ? "Memuat..." : "Tidak ada data investor"}
                    </div>
                  ) : (
                    investors.map((investor) => (
                      <SelectItem
                        key={investor.kode ?? investor.nama ?? Math.random().toString()}
                        value={investor.kode ?? `_no_kode_${investor.nama}`}
                      >
                        {investor.kode ?? "(no kode)"} - {investor.nama}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {errors.kode && (
              <p className="text-sm text-red-500">{errors.kode.message}</p>
            )}
          </div>

          {/* Field Nama */}
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Investor</Label>
            <Input
              id="nama"
              value={isLoadingData ? "Loading..." : watch("nama")}
              readOnly
              className="bg-gray-50"
            />
            {errors.nama && (
              <p className="text-sm text-red-500">{errors.nama.message}</p>
            )}
          </div>

          {/* Field Rekening Bank */}
          <div className="space-y-2">
            <Label htmlFor="rekening_bank">Nomor Rekening</Label>
            <Input
              id="rekening_bank"
              value={watch("rekening_bank") || ""}
              onChange={(e) => setValue("rekening_bank", e.target.value)}
              placeholder="Masukkan nomor rekening"
            />
          </div>

          {/* Info Saldo */}
          {investorSaldo !== null && (
            <div className="bg-gray-50 p-4 rounded-md space-y-3 border">
              <div className="flex justify-between items-center">
                <span className="font-medium">Saldo Saat Ini:</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-bold text-lg",
                      saldoWarning ? "text-orange-600" : "text-blue-600",
                    )}
                  >
                    Rp {investorSaldo.toLocaleString("id-ID")}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setShowDebug(!showDebug)}
                    title="Toggle debug info"
                  >
                    <RefreshCw
                      className={cn("h-4 w-4", showDebug && "rotate-180")}
                    />
                  </Button>
                </div>
              </div>

              {/* Warning Message */}
              {saldoWarning && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-yellow-400">⚠️</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">{saldoWarning}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Debug Panel */}
              {showDebug && (
                <div className="mt-2 text-xs border-t pt-2 space-y-2">
                  <p className="font-semibold">Debug Info:</p>
                  <div className="text-gray-600">
                    <p>
                      Saldo dihitung dari transaksi yang sudah APPROVE oleh
                      kedua admin.
                    </p>
                    <p className="mt-1">
                      Total transaksi untuk investor ini:{" "}
                      {transactions.filter((t) => t.kode === kodeValue).length}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={refreshData}
                    disabled={loading}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh Data
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Field Jenis Mutasi */}
          <div className="space-y-2">
            <Label htmlFor="mutasi">Jenis Mutasi</Label>
            <Select
              onValueChange={(value: "KREDIT" | "DEBET") => {
                setValue("mutasi", value);
                // Reset bukti transfer jika berganti ke DEBET
                if (value === "DEBET") {
                  setBuktiTransferFile(null);
                }
              }}
              value={mutasiValue}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis mutasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KREDIT">KREDIT (Setoran)</SelectItem>
                <SelectItem value="DEBET">DEBET (Penarikan)</SelectItem>
              </SelectContent>
            </Select>
            {errors.mutasi && (
              <p className="text-sm text-red-500">{errors.mutasi.message}</p>
            )}
          </div>

          {/* Field Nilai Mutasi */}
          <div className="space-y-2">
            <Label htmlFor="nilai_mutasi">Nilai Mutasi (Rp)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                Rp
              </span>
              <Input
                id="nilai_mutasi"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={nilaiMutasi > 0 ? nilaiMutasi : ""}
                onChange={handleNilaiMutasiChange}
                className="pl-10"
              />
            </div>
            {nilaiMutasi > 0 && (
              <p className="text-xs text-gray-500">
                Terformat: Rp {formatNumber(nilaiMutasi)}
              </p>
            )}
            {errors.nilai_mutasi && (
              <p className="text-sm text-red-500">
                {errors.nilai_mutasi.message}
              </p>
            )}
            {inputError && <p className="text-sm text-red-500">{inputError}</p>}

            {/* Info sisa saldo untuk DEBET */}
            {mutasiValue === "DEBET" &&
              investorSaldo !== null &&
              nilaiMutasi > 0 &&
              nilaiMutasi <= investorSaldo && (
                <p className="text-sm text-green-600">
                  Sisa setelah penarikan: Rp{" "}
                  {(investorSaldo - nilaiMutasi).toLocaleString("id-ID")}
                </p>
              )}
          </div>

          {/* Field Keterangan */}
          <div className="space-y-2">
            <Label htmlFor="keterangan">Keterangan</Label>
            <Textarea
              id="keterangan"
              value={watch("keterangan") || ""}
              onChange={(e) => setValue("keterangan", e.target.value)}
              placeholder="Masukkan keterangan (opsional)"
              rows={3}
            />
          </div>

          {/* Field Bukti Transfer - Hanya untuk KREDIT (SETORAN) */}
          {mutasiValue === "KREDIT" && (
            <div className="space-y-2">
              <Label htmlFor="bukti_transfer">
                Bukti Transfer{" "}
                {isUserMode && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="bukti_transfer"
                type="file"
                accept="image/*,.pdf"
                required={isUserMode}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setBuktiTransferFile(file);
                }}
              />
              {buktiTransferFile && (
                <p className="text-xs text-gray-500">
                  File: {buktiTransferFile.name}
                </p>
              )}
              {isUserMode && (
                <p className="text-xs text-gray-500">
                  * Bukti transfer wajib diisi untuk transaksi setoran (KREDIT)
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                isLoadingData ||
                (mutasiValue === "DEBET" && !!saldoWarning) ||
                !!inputError
              }
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
