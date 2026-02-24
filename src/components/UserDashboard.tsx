"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { DataTable } from "@/app/history/data-table";
import { AddMutasiDialog } from "@/app/history/add-mutasi-dialog";
import { ExportPdfButton } from "@/app/investor-dashboard/export-pdf-button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";

type HistoryRecord = {
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
  admin1_status?: "PROSES" | "APPROVE" | "REJECT";
  admin2_status?: "PENDING" | "PROSES" | "APPROVE" | "REJECT";
  status?: "PROSES" | "APPROVE" | "REJECT"; // For backward compatibility
  investor: {
    id: string;
    nama: string | null;
    kode: string | null;
    rekening_bank: string | null;
  };
};

const columns: ColumnDef<HistoryRecord>[] = [
  {
    accessorKey: "tanggal",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting()}
          className="h-8 px-2"
        >
          Tanggal
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    sortingFn: (rowA, rowB) => {
      const dateA = new Date(rowA.getValue("tanggal"));
      const dateB = new Date(rowB.getValue("tanggal"));
      return dateA.getTime() - dateB.getTime();
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("tanggal"));
      const day = date.getDate();
      const month = date.toLocaleDateString("id-ID", { month: "short" });
      const year = date.getFullYear();
      return (
        <div className="font-medium">
          {day}/{month}/{year}
        </div>
      );
    },
    size: 120,
  },
  {
    accessorKey: "mutasi",
    header: "Jenis Mutasi",
    cell: ({ row }) => {
      const mutasi = row.getValue("mutasi") as string;
      return (
        <Badge
          className={cn(
            "text-xs font-semibold px-2 py-1",
            mutasi === "KREDIT" &&
              "bg-green-100 text-green-800 border-green-200",
            mutasi === "DEBET" && "bg-red-100 text-red-800 border-red-200",
          )}
        >
          {mutasi}
        </Badge>
      );
    },
    size: 120,
  },
  {
    accessorKey: "nilai_mutasi",
    header: () => <div className="text-right font-semibold">Nilai Mutasi</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("nilai_mutasi"));
      const formatted = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);

      return <div className="text-right font-medium">{formatted}</div>;
    },
    size: 150,
  },
  {
    accessorKey: "saldo_akhir",
    header: () => <div className="text-right font-semibold">Saldo Rill</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("saldo_akhir"));
      const formatted = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);

      return <div className="text-right font-medium">{formatted}</div>;
    },
    size: 150,
  },
  {
    accessorKey: "keterangan",
    header: () => <div className="text-center font-semibold">Keterangan</div>,
    cell: ({ row }) => {
      const keterangan = row.getValue("keterangan") as string;
      return (
        <div className="text-center max-w-xs truncate" title={keterangan}>
          {keterangan || "-"}
        </div>
      );
    },
    enableHiding: false,
    size: 200,
  },
  {
    id: "admin1_approve",
    header: "Admin 1",
    cell: ({ row }) => {
      const record = row.original;
      const isApproved = record.admin1_status === "APPROVE";
      const isRejected = record.admin1_status === "REJECT";
      return (
        <Badge
          className={
            isApproved
              ? "bg-green-500/80"
              : isRejected
                ? "bg-red-500/80"
                : "bg-yellow-500/80"
          }
        >
          {isApproved
            ? "Approved"
            : isRejected
              ? "Rejected"
              : record.admin1_status}
        </Badge>
      );
    },
    size: 100,
  },
  {
    id: "admin2_approve",
    header: "Admin 2",
    cell: ({ row }) => {
      const record = row.original;
      const isApproved = record.admin2_status === "APPROVE";
      const isRejected = record.admin2_status === "REJECT";
      return (
        <Badge
          className={
            isApproved
              ? "bg-green-500/80"
              : isRejected
                ? "bg-red-500/80"
                : "bg-amber-300/80"
          }
        >
          {isApproved
            ? "Approved"
            : isRejected
              ? "Rejected"
              : record.admin2_status}
        </Badge>
      );
    },
    size: 100,
  },
  {
    accessorKey: "bukti_transfer",
    header: "Bukti Transfer",
    cell: ({ row }) => {
      const bukti = row.getValue("bukti_transfer") as string;
      return bukti ? (
        <Dialog>
          <DialogTrigger asChild>
            <img
              src={bukti}
              alt="Bukti Transfer"
              className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
            />
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogTitle className="sr-only">Bukti Transfer</DialogTitle>
            <img
              src={bukti}
              alt="Bukti Transfer"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      ) : (
        "-"
      );
    },
    size: 120,
  },
];

const UserDashboard = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationMessage, setNotificationMessage] = useState<string>("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/investor/history");
      if (res.ok) {
        const result = await res.json();
        // Transform to match HistoryRecord format
        const transformedData: HistoryRecord[] = result.transactions.map(
          (t: any) => {
            // Derive admin statuses from old status if new fields are not available
            let admin1_status = t.admin1_status;
            let admin2_status = t.admin2_status;

            if (!admin1_status && !admin2_status && t.status) {
              // Fallback to old status field
              if (t.status === "FIRST_APPROVED") {
                admin1_status = "APPROVE";
                admin2_status = "PROSES";
              } else if (t.status === "APPROVED") {
                admin1_status = "APPROVE";
                admin2_status = "APPROVE";
              } else if (t.status === "REJECT") {
                admin1_status = "REJECT";
                admin2_status = "REJECT";
              } else if (t.status === "PROSES") {
                admin1_status = "PROSES";
                admin2_status = "PENDING";
              }
            }

            return {
              id: t.id,
              tanggal: t.tanggal,
              kode: t.kode,
              nama: t.nama,
              rekening_bank: t.rekening_bank,
              mutasi: t.mutasi,
              nilai_mutasi: t.nilai_mutasi,
              saldo_akhir: t.saldo_akhir,
              keterangan: t.keterangan,
              bukti_transfer: t.bukti_transfer,
              admin1_status,
              admin2_status,
              status: t.status, // Keep for backward compatibility
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
              investorId: t.investorId,
              investor: {
                id: t.investorId,
                nama: t.nama,
                kode: t.kode,
                rekening_bank: t.rekening_bank,
              },
            };
          },
        );
        setData(transformedData);
      } else {
        console.error("Failed to fetch data:", res.status, res.statusText);
      }
    } catch (error) {
      console.error("Error fetching investor data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
      // Check if current date is between 1-7
      const currentDay = new Date().getDate();
      const isAllowed = currentDay >= 1 && currentDay <= 7;
      if (!isAllowed) {
        setNotificationMessage(
          "Transaksi hanya bisa dilakukan pada tanggal 1-7 setiap bulan.",
        );
      } else {
        setNotificationMessage("");
      }
    }
  }, [session]);

  if (!session) {
    return null;
  }

  const userName = session.user?.name || "User";

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <Card className="mx-4">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-center">
                    Selamat Datang, {userName}!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <Card className="mx-4">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">
                  Selamat Datang, {userName}!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-600 mb-6">
                  Terima kasih telah bergabung dengan platform kami. Semoga hari
                  Anda menyenangkan!
                </p>

                <div className="mb-8 px-4 py-2 bg-secondary rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                    <h1 className="font-semibold">History Mutasi</h1>
                    {notificationMessage && (
                      <p className="text-sm text-red-600">
                        {notificationMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <ExportPdfButton
                      investor={{
                        nama: session.user?.name || "User",
                        kode: (session.user as any)?.kode || "",
                        rekening_bank: "",
                        atas_nama_rekening: "",
                        whatsapp: "",
                        email: session.user?.email || "",
                      }}
                      transactions={data.map((t) => ({
                        id: t.id,
                        tanggal: t.tanggal,
                        kode: t.kode,
                        nama: t.nama,
                        rekening_bank: t.rekening_bank,
                        mutasi: t.mutasi,
                        nilai_mutasi: t.nilai_mutasi,
                        saldo_akhir: t.saldo_akhir,
                        keterangan: t.keterangan,
                        // IMPORTANT: Include admin status fields
                        admin1_status: t.admin1_status,
                        admin2_status: t.admin2_status,
                      }))}
                    />
                    <AddMutasiDialog
                      onSuccess={fetchData}
                      isUserMode={true}
                      userKode={(session.user as any)?.kode}
                      disabled={notificationMessage !== ""}
                    />
                  </div>
                </div>
                <DataTable
                  columns={columns}
                  data={data}
                  onBulkDelete={() => {}}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
