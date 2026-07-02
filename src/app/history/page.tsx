"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { HistoryRecord, columns } from "./columns";
import { DataTable } from "./data-table";
import { AddMutasiDialog } from "./add-mutasi-dialog";
import { EditMutasiDialog } from "./edit-mutasi-dialog";
import { ApproveWithUploadDialog } from "./approve-with-upload-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const HistoryPage = () => {
  const { data: session, status } = useSession();

  // Debug
  console.log("Session status:", status);
  console.log("Session data:", session);

  // Ambil role dengan aman
  const userRole = session?.user?.role;

  console.log("Current userRole:", userRole);

  const [data, setData] = useState<HistoryRecord[]>([]);
  const [investors, setInvestors] = useState<{ kode: string | null; nama: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [investorFilter, setInvestorFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [approveUploadDialogOpen, setApproveUploadDialogOpen] = useState(false);
  const [approvingRecordId, setApprovingRecordId] = useState<string | null>(
    null,
  );
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const getCurrentMonthString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthString());
  const [actionType, setActionType] = useState<"DEBET" | "KREDIT" | "DANA_TERPAKAI" | "">("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 400);
  };

  const fetchData = async (page = currentPage) => {
    console.time("fetchData");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (investorFilter !== "all") params.set("kode", investorFilter);

      const res = await fetch(`/api/history?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        // Handle both old array response and new paginated response
        if (Array.isArray(result)) {
          setData(result);
          setTotalCount(result.length);
          setTotalPages(1);
        } else {
          setData(result.data);
          setTotalCount(result.totalCount);
          setTotalPages(result.totalPages);
        }
      }
    } catch (error) {
      console.error("Error fetching history data:", error);
    } finally {
      setLoading(false);
      console.timeEnd("fetchData");
    }
  };

  const fetchInvestors = async () => {
    try {
      const res = await fetch("/api/investors");
      if (res.ok) {
        const result = await res.json();
        setInvestors(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      console.error("Error fetching investors:", error);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchInvestors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentPage, investorFilter, debouncedSearch]);

  const handleSuccess = () => {
    fetchData(currentPage);
  };

  const handleDelete = async (id: string) => {
    fetchData(currentPage); // Refresh data after delete
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (
      confirm(`Are you sure you want to delete ${ids.length} selected records?`)
    ) {
      try {
        const deletePromises = ids.map((id) =>
          fetch(`/api/history/${id}`, { method: "DELETE" }),
        );
        const results = await Promise.all(deletePromises);
        const failedDeletes = results.filter((res) => !res.ok).length;

        if (failedDeletes === 0) {
          alert(`Successfully deleted ${ids.length} records`);
          fetchData(currentPage);
        } else {
          alert(
            `Failed to delete ${failedDeletes} out of ${ids.length} records`,
          );
          fetchData(currentPage); // Refresh anyway to show current state
        }
      } catch (error) {
        console.error("Error deleting records:", error);
        alert("Error deleting records");
      }
    }
  };

  const handleEdit = (id: string) => {
    setEditingRecordId(id);
    setEditDialogOpen(true);
  };

  const handleApprove = async (id: string, status: string) => {
    const record = data.find((r) => r.id === id);

    // DEBUG: Log untuk memastikan kondisi terpenuhi
    console.log("handleApprove called with:", { id, status, userRole, record });

    // MODIFIKASI: Admin1 yang upload bukti transfer untuk transaksi DEBET
    if (userRole === "ADMIN1" && record?.mutasi === "DEBET") {
      console.log("Opening upload dialog for ADMIN1 DEBET transaction");
      setApprovingRecordId(id);
      setApproveUploadDialogOpen(true);
      return;
    }

    const confirmMessage =
      userRole === "ADMIN1"
        ? "Are you sure you want to approve this transaction as Admin 1?"
        : "Are you sure you want to approve this transaction as Admin 2?";

    if (confirm(confirmMessage)) {
      try {
        const res = await fetch(`/api/history/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          fetchData(currentPage);
        } else {
          alert("Failed to approve transaction");
        }
      } catch (error) {
        console.error("Error approving transaction:", error);
        alert("Error approving transaction");
      }
    }
  };

  const handleReject = async (id: string) => {
    if (confirm("Are you sure you want to reject this transaction?")) {
      try {
        const res = await fetch(`/api/history/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "REJECT" }),
        });
        if (res.ok) {
          fetchData(currentPage);
        } else {
          alert("Failed to reject transaction");
        }
      } catch (error) {
        console.error("Error rejecting transaction:", error);
        alert("Error rejecting transaction");
      }
    }
  };

  // filteredData: search & filter sudah dilakukan server-side
  const filteredData = data;

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="">
      <div className="mb-8 px-4 py-2 bg-secondary rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <h1 className="font-semibold">History Mutasi</h1>
          <Select value={investorFilter} onValueChange={(v) => { setInvestorFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter Investor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Investor</SelectItem>
              {investors
                .filter((inv) => inv.kode)
                .sort((a, b) => (a.nama ?? "").localeCompare(b.nama ?? ""))
                .map((investor) => (
                  <SelectItem key={investor.kode!} value={investor.kode!}>
                    {investor.kode} - {investor.nama}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Cari..."
              value={searchText}
              onChange={(e) => { handleSearchChange(e.target.value); }}
              className="w-[200px]"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Tombol processing hanya muncul untuk SUPER_ADMIN dan ADMIN1 */}
          {(userRole === "SUPER_ADMIN" || userRole === "ADMIN1") && (
            <>
              <Button
                onClick={() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, "0");
                  setSelectedMonth(`${year}-${month}`);
                  setActionType("DEBET");
                  setActionDialogOpen(true);
                }}
              >
                Dana Terpakai -
              </Button>
              <Button
                onClick={() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, "0");
                  setSelectedMonth(`${year}-${month}`);
                  setActionType("KREDIT");
                  setActionDialogOpen(true);
                }}
              >
                Profit Sharing
              </Button>
              <Button
                onClick={() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, "0");
                  setSelectedMonth(`${year}-${month}`);
                  setActionType("DANA_TERPAKAI");
                  setActionDialogOpen(true);
                }}
              >
                Dana Terpakai +
              </Button>
            </>
          )}
          {/* Add Transaction muncul untuk SUPER_ADMIN dan ADMIN1 */}
          {(userRole === "SUPER_ADMIN" || userRole === "ADMIN1") && (
            <AddMutasiDialog onSuccess={handleSuccess} />
          )}
        </div>
      </div>
      <DataTable
        columns={columns(
          handleDelete,
          handleEdit,
          handleApprove,
          handleReject,
          userRole,
        )}
        data={filteredData}
        onBulkDelete={handleBulkDelete}
      />

      {/* Server-side Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-muted-foreground">
            Menampilkan {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, totalCount)} dari {totalCount} data
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              «
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ‹ Prev
            </Button>
            <span className="text-sm font-medium px-2">
              Halaman {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next ›
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              »
            </Button>
          </div>
        </div>
      )}
      <EditMutasiDialog
        recordId={editingRecordId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
      />
      <ApproveWithUploadDialog
        recordId={approvingRecordId}
        open={approveUploadDialogOpen}
        onOpenChange={(open) => {
          setApproveUploadDialogOpen(open);
          if (!open) {
            setApprovingRecordId(null);
          }
        }}
        onSuccess={handleSuccess}
      />
      <Dialog open={actionDialogOpen} onOpenChange={(open) => { if (!isProcessing) { setActionDialogOpen(open); if (!open) setSelectedMonth(getCurrentMonthString()); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "DEBET" && "Proses Auto Debet (Dana Terpakai -)"}
              {actionType === "KREDIT" && "Proses Profit Sharing"}
              {actionType === "DANA_TERPAKAI" && "Proses Auto Kredit (Dana Terpakai +)"}
            </DialogTitle>
          </DialogHeader>

          {/* Loading overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-white/80 dark:bg-black/60 flex flex-col items-center justify-center z-[60] rounded-lg gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Sedang memproses, harap tunggu...</p>
            </div>
          )}

          <div className="py-4">
            <label className="block text-sm font-medium mb-2">Pilih Bulan & Tahun</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={isProcessing}
              style={{ colorScheme: "light" }}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setActionDialogOpen(false); setSelectedMonth(getCurrentMonthString()); }}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button
              disabled={isProcessing || !selectedMonth}
              onClick={async () => {
                if (!selectedMonth) return;
                const [year, month] = selectedMonth.split("-");
                // month is 1-indexed string, we need 0-indexed for backend
                const monthIndex = parseInt(month, 10) - 1;

                setIsProcessing(true);
                try {
                  let url = "";
                  if (actionType === "DEBET") url = "/api/history/process-debet";
                  else if (actionType === "KREDIT") url = "/api/history/process-kredit";
                  else if (actionType === "DANA_TERPAKAI") url = "/api/history/process-dana-terpakai";

                  if (!url) return;

                  const res = await fetch(url, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      year: parseInt(year, 10),
                      month: monthIndex,
                    }),
                  });
                  if (res.ok) {
                    alert("Proses berhasil");
                    fetchData(currentPage);
                    setActionDialogOpen(false);
                    setSelectedMonth(getCurrentMonthString());
                  } else {
                    alert("Proses gagal");
                  }
                } catch (error) {
                  console.error("Error processing:", error);
                  alert("Error saat memproses data");
                } finally {
                  setIsProcessing(false);
                }
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Proses"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoryPage;
