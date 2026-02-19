"use client";

import { useState, useEffect } from "react";
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

const HistoryPage = () => {
  const { data: session, status } = useSession();

  // Debug
  console.log("Session status:", status);
  console.log("Session data:", session);

  // Ambil role dengan aman
  const userRole = session?.user?.role;

  console.log("Current userRole:", userRole);

  const [data, setData] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [investorFilter, setInvestorFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [approveUploadDialogOpen, setApproveUploadDialogOpen] = useState(false);
  const [approvingRecordId, setApprovingRecordId] = useState<string | null>(
    null,
  );

  const fetchData = async () => {
    console.time("fetchData");
    try {
      const res = await fetch("/api/history?limit=1000000");
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching history data:", error);
    } finally {
      setLoading(false);
      console.timeEnd("fetchData");
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const handleSuccess = () => {
    fetchData();
  };

  const handleDelete = async (id: string) => {
    fetchData(); // Refresh data after delete
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
          fetchData();
        } else {
          alert(
            `Failed to delete ${failedDeletes} out of ${ids.length} records`,
          );
          fetchData(); // Refresh anyway to show current state
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
    // Check if ADMIN2 and DEBET mutation requires bukti transfer
    const record = data.find((r) => r.id === id);
    if (userRole === "ADMIN2" && record?.mutasi === "DEBET") {
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
          fetchData();
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
          fetchData();
        } else {
          alert("Failed to reject transaction");
        }
      } catch (error) {
        console.error("Error rejecting transaction:", error);
        alert("Error rejecting transaction");
      }
    }
  };

  // Get unique investors for filter
  const uniqueInvestors = Array.from(
    new Set(data.map((record) => record.nama).filter(Boolean)),
  ).sort();

  // Filter data based on search and investor filter
  const filteredData = data.filter((record) => {
    const matchesSearch =
      record.kode?.toLowerCase().includes(searchText.toLowerCase()) ||
      record.nama?.toLowerCase().includes(searchText.toLowerCase()) ||
      record.keterangan?.toLowerCase().includes(searchText.toLowerCase());

    const matchesInvestor =
      investorFilter === "all" || record.nama === investorFilter;

    return matchesSearch && matchesInvestor;
  });

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="">
      <div className="mb-8 px-4 py-2 bg-secondary rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <h1 className="font-semibold">History Mutasi</h1>
          <Select value={investorFilter} onValueChange={setInvestorFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter Investor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Investor</SelectItem>
              {uniqueInvestors.map((investor) => (
                <SelectItem key={investor} value={investor || ""}>
                  {investor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Tombol hanya muncul untuk SUPER_ADMIN */}
          {userRole === "SUPER_ADMIN" && (
            <>
              <Button
                onClick={async () => {
                  if (
                    confirm(
                      "Are you sure you want to process an auto debit of Used Funds for all investors?",
                    )
                  ) {
                    try {
                      const res = await fetch("/api/history/process-debet", {
                        method: "POST",
                      });
                      if (res.ok) {
                        alert(
                          "Auto dana terpakai/bulan processed successfully",
                        );
                        fetchData();
                      } else {
                        alert("Failed to process auto dana terpakai/bulan");
                      }
                    } catch (error) {
                      console.error("Error processing auto debit:", error);
                      alert("Error processing auto debit");
                    }
                  }
                }}
              >
                Dana Terpakai -
              </Button>
              <Button
                onClick={async () => {
                  if (
                    confirm(
                      "Are you sure you want to process automatic Profit Sharing for all investors?",
                    )
                  ) {
                    try {
                      const res = await fetch("/api/history/process-kredit", {
                        method: "POST",
                      });
                      if (res.ok) {
                        alert("Auto kredit processed successfully");
                        fetchData();
                      } else {
                        alert("Failed to process auto kredit");
                      }
                    } catch (error) {
                      console.error("Error processing auto kredit:", error);
                      alert("Error processing auto kredit");
                    }
                  }
                }}
              >
                Profit Sharing
              </Button>
              <Button
                onClick={async () => {
                  if (
                    confirm(
                      "Are you sure you want to process auto Credit Used Funds for all investors?",
                    )
                  ) {
                    try {
                      const res = await fetch(
                        "/api/history/process-dana-terpakai",
                        {
                          method: "POST",
                        },
                      );
                      if (res.ok) {
                        alert(
                          "Dana terpakai jatuh tempo processed successfully",
                        );
                        fetchData();
                      } else {
                        alert("Failed to process dana terpakai jatuh tempo");
                      }
                    } catch (error) {
                      console.error("Error processing dana terpakai:", error);
                      alert("Error processing dana terpakai jatuh tempo");
                    }
                  }
                }}
              >
                Dana Terpakai +
              </Button>
              <AddMutasiDialog onSuccess={handleSuccess} />
            </>
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
    </div>
  );
};

export default HistoryPage;
