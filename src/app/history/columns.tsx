"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  MoreHorizontal,
  Trash2,
  Edit,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useState } from "react";

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PROSES":
        return {
          label: status,
          className: "bg-yellow-500/80",
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
        };
      case "FIRST_APPROVED":
        return {
          label: "Admin 1",
          className: "bg-blue-500/80",
          icon: <Check className="h-3 w-3" />,
        };
      case "APPROVED":
        return {
          label: "Admin 2",
          className: "bg-green-500/80",
          icon: <Check className="h-3 w-3" />,
        };
      case "REJECT":
        return {
          label: status,
          className: "bg-red-500/80",
          icon: <X className="h-3 w-3" />,
        };
      default:
        return {
          label: status,
          className: "bg-gray-500/80",
          icon: null,
        };
    }
  };

  const { label, className, icon } = getStatusConfig(status);

  return (
    <Badge className={className}>
      <div className="flex items-center gap-1">
        {icon}
        {label}
      </div>
    </Badge>
  );
};

export type HistoryRecord = {
  id: string;
  tanggal: string;
  kode: string;
  nama: string | null;
  rekening_bank: string | null;
  mutasi: "KREDIT" | "DEBET";
  nilai_mutasi: number;
  saldo_akhir: number;
  keterangan: string | null;
  admin1_status?: "PROSES" | "APPROVE" | "REJECT";
  admin2_status?: "PENDING" | "PROSES" | "APPROVE" | "REJECT";
  status?: "PROSES" | "FIRST_APPROVED" | "APPROVED" | "REJECT"; // For backward compatibility
  investor: {
    id: string;
    nama: string | null;
    kode: string | null;
    rekening_bank: string | null;
  };
};

export const columns = (
  onDelete?: (id: string) => void,
  onEdit?: (id: string) => void,
  onApprove?: (id: string, status: string) => void,
  onReject?: (id: string) => void,
  userRole?: string,
): ColumnDef<HistoryRecord>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(event) =>
          table.toggleAllPageRowsSelected(!!event.target.checked)
        }
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={(event) => row.toggleSelected(!!event.target.checked)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "tanggal",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Tanggal
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("tanggal"));
      const day = date.getDate();
      const month = date.toLocaleDateString("en-US", { month: "short" });
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    },
    sortingFn: (rowA, rowB) => {
      const dateA = new Date(rowA.getValue("tanggal"));
      const dateB = new Date(rowB.getValue("tanggal"));
      return dateA.getTime() - dateB.getTime();
    },
  },
  {
    accessorKey: "kode",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Kode Investor
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "nama",
    header: "Nama Investor",
  },
  // {
  //   accessorKey: "rekening_bank",
  //   header: "Nomor Rekening",
  // },
  {
    accessorKey: "mutasi",
    header: "Jenis Mutasi",
    cell: ({ row }) => {
      const mutasi = row.getValue("mutasi") as string;
      return (
        <Badge
          className={cn(
            mutasi === "KREDIT" && "bg-green-500/80",
            mutasi === "DEBET" && "bg-red-500/80",
          )}
        >
          {mutasi}
        </Badge>
      );
    },
  },
  {
    accessorKey: "nilai_mutasi",
    header: () => <div className="text-right">Nilai Mutasi</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("nilai_mutasi"));
      const formatted = amount.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "saldo_akhir",
    header: () => <div className="text-right">Saldo</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("saldo_akhir"));
      const formatted = amount.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "keterangan",
    header: "Keterangan",
  },
  {
    accessorKey: "bukti_transfer",
    header: "Bukti Transfer",
    cell: ({ row }) => {
      const bukti = row.getValue("bukti_transfer") as string;
      if (bukti) {
        return (
          <a
            href={bukti}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Lihat
          </a>
        );
      }
      return <span className="text-gray-400">-</span>;
    },
  },
  {
    id: "admin1_approve",
    header: "Admin 1",
    cell: ({ row }) => {
      const record = row.original;
      const isApproved = record.admin1_status === "APPROVE";
      const isRejected = record.admin1_status === "REJECT";
      const isInProcess =
        record.admin1_status === "PROSES" ||
        (record as any).status === "PROSES" ||
        (!record.admin1_status && !record.admin2_status); // Fallback for records without new fields
      if (
        (userRole === "ADMIN1" || userRole === "SUPER_ADMIN") &&
        isInProcess
      ) {
        return (
          <div className="flex gap-1">
            <Button
              size="default"
              onClick={() => onApprove && onApprove(record.id, "APPROVE")}
              className="bg-lime-400 hover:bg-lime-600 text-white"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="default"
              onClick={() => onReject && onReject(record.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        );
      }
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
  },
  {
    id: "admin2_approve",
    header: "Admin 2",
    cell: ({ row }) => {
      const record = row.original;
      const isApproved = record.admin2_status === "APPROVE";
      const isRejected = record.admin2_status === "REJECT";

      // Check if Admin 1 has approved
      const admin1Approved = record.admin1_status === "APPROVE";

      // Admin 2 can approve if:
      // 1. User is ADMIN2
      // 2. Admin 1 has approved
      // 3. Admin 2 status is NOT already APPROVE or REJECT (masih bisa diubah)
      const canApprove =
        userRole === "ADMIN2" &&
        admin1Approved &&
        record.admin2_status !== "APPROVE" &&
        record.admin2_status !== "REJECT";

      // Special case for DEBET mutations that need file upload
      const needsUpload =
        userRole === "ADMIN2" &&
        admin1Approved &&
        record.mutasi === "DEBET" &&
        record.admin2_status !== "APPROVE" &&
        record.admin2_status !== "REJECT";

      // If Admin 2 can approve, show buttons
      if (canApprove || needsUpload) {
        return (
          <div className="flex gap-1">
            <Button
              size="default"
              onClick={() => onApprove && onApprove(record.id, "APPROVE")}
              className="bg-lime-400 hover:bg-lime-600 text-white"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="default"
              onClick={() => onReject && onReject(record.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        );
      }

      // Determine badge style based on state
      let badgeClass = "";
      let displayText = "";

      if (isApproved) {
        badgeClass = "bg-green-500/80";
        displayText = "Approved";
      } else if (isRejected) {
        badgeClass = "bg-red-500/80";
        displayText = "Rejected";
      } else if (admin1Approved) {
        // Jika Admin 1 sudah approve tapi Admin 2 belum action, tampilkan "PROSES"
        badgeClass = "bg-yellow-500/80";
        displayText = record.admin2_status || "PROSES";
      } else {
        // Jika Admin 1 belum approve, tampilkan "PENDING"
        badgeClass = "bg-amber-300/80";
        displayText = "PENDING";
      }

      return <Badge className={badgeClass}>{displayText}</Badge>;
    },
  },
  // {
  //   id: "admin2_approve",
  //   header: "Admin 2",
  //   cell: ({ row }) => {
  //     const record = row.original;
  //     const isApproved = record.admin2_status === "APPROVE";
  //     const isRejected = record.admin2_status === "REJECT";
  //     const isInProcess = record.admin2_status === "PROSES";
  //     const canApprove =
  //       userRole === "ADMIN2" &&
  //       (isInProcess ||
  //         (record.mutasi === "DEBET" && record.admin2_status === "PENDING"));
  //     if (canApprove) {
  //       return (
  //         <div className="flex gap-1">
  //           <Button
  //             size="default"
  //             onClick={() => onApprove && onApprove(record.id, "APPROVE")}
  //             className="bg-lime-400 hover:bg-lime-600 text-white"
  //           >
  //             <Check className="h-4 w-4 mr-1" />
  //             Approve
  //           </Button>
  //           <Button
  //             size="default"
  //             onClick={() => onReject && onReject(record.id)}
  //             className="bg-red-600 hover:bg-red-700 text-white"
  //           >
  //             <X className="h-4 w-4 mr-1" />
  //             Reject
  //           </Button>
  //         </div>
  //       );
  //     }
  //     return (
  //       <Badge
  //         className={
  //           isApproved
  //             ? "bg-green-500/80"
  //             : isRejected
  //               ? "bg-red-500/80"
  //               : "bg-amber-300/80"
  //         }
  //       >
  //         {isApproved
  //           ? "Approved"
  //           : isRejected
  //             ? "Rejected"
  //             : record.admin2_status}
  //       </Badge>
  //     );
  //   },
  // },

  {
    id: "actions",
    cell: ({ row }) => {
      const record = row.original;
      const showApproveReject =
        ((userRole === "ADMIN1" || userRole === "SUPER_ADMIN") &&
          record.admin1_status === "PROSES") ||
        (userRole === "ADMIN2" && record.admin2_status === "PROSES");
      const [isDeleting, setIsDeleting] = useState(false);

      const handleDelete = async () => {
        setIsDeleting(true);
        try {
          const response = await fetch(`/api/history/${record.id}`, {
            method: "DELETE",
          });

          if (response.ok) {
            if (onDelete) onDelete(record.id);
          } else {
            const error = await response.json();
            alert(error.error || "Gagal menghapus record");
          }
        } catch (error) {
          console.error("Error deleting record:", error);
          alert("Gagal menghapus record");
        } finally {
          setIsDeleting(false);
        }
      };

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {(record.admin2_status !== "APPROVE" ||
              userRole === "SUPER_ADMIN") && (
              <DropdownMenuItem
                onClick={() => onEdit && onEdit(record.id)}
                className="text-blue-600 focus:text-blue-600"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {(showApproveReject || record.admin2_status !== "APPROVE") && (
              <DropdownMenuSeparator />
            )}
            {((userRole === "ADMIN1" || userRole === "SUPER_ADMIN") &&
              record.admin1_status === "PROSES") ||
            (userRole === "ADMIN2" && record.admin2_status === "PROSES") ? (
              <>
                <DropdownMenuItem
                  onClick={() => onApprove && onApprove(record.id, "APPROVE")}
                  className="text-green-600 focus:text-green-600"
                >
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onReject && onReject(record.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  Reject
                </DropdownMenuItem>
              </>
            ) : null}
            {(record.admin2_status !== "APPROVE" ||
              userRole === "SUPER_ADMIN") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini tidak dapat dibatalkan. Ini akan menghapus
                      record secara permanen dan menghapus data dari server.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? "Menghapus..." : "Hapus"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
