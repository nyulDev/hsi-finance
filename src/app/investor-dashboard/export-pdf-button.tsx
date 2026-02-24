"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import { useState, useMemo } from "react";

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
  admin1_status?: "PROSES" | "APPROVE" | "REJECT";
  admin2_status?: "PENDING" | "PROSES" | "APPROVE" | "REJECT";
}

interface Investor {
  nama: string;
  kode: string;
  rekening_bank: string;
  atas_nama_rekening: string;
  whatsapp: string;
  email: string;
}

interface ExportPdfButtonProps {
  investor: Investor;
  transactions: Transaction[];
}

export function ExportPdfButton({
  investor,
  transactions,
}: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Calculate all values with useMemo for performance
  const { recentTransactions, availableFunds, heldFunds, totalSaldoInvestor } =
    useMemo(() => {
      // Filter transactions for last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      threeMonthsAgo.setHours(0, 0, 0, 0);

      const recent = transactions
        .filter((transaction) => {
          const transactionDate = new Date(transaction.tanggal);
          transactionDate.setHours(0, 0, 0, 0);
          return transactionDate >= threeMonthsAgo;
        })
        .sort(
          (a, b) =>
            new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime(),
        );

      // Calculate Dana Tersedia: latest saldo_akhir in the current month
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const currentMonthTransactions = transactions
        .filter((t) => {
          const date = new Date(t.tanggal);
          return (
            date.getFullYear() === currentYear &&
            date.getMonth() === currentMonth
          );
        })
        .sort(
          (a, b) =>
            new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime(),
        );

      const available =
        currentMonthTransactions.length > 0
          ? currentMonthTransactions[0].saldo_akhir
          : 0;

      // Calculate Dana Ditahan: SUM of nilai_mutasi where
      // admin1_status is NOT "APPROVE" OR admin2_status is NOT "APPROVE"
      const heldTransactions = transactions.filter((t) => {
        const admin1NotApprove =
          t.admin1_status && t.admin1_status !== "APPROVE";
        const admin2NotApprove =
          t.admin2_status && t.admin2_status !== "APPROVE";

        return admin1NotApprove || admin2NotApprove;
      });

      const held = heldTransactions.reduce((sum, t) => sum + t.nilai_mutasi, 0);

      // Log for debugging (only in development)
      if (process.env.NODE_ENV === "development") {
        console.log("=== Dana Ditahan Debug ===");
        console.log("Total transactions:", transactions.length);
        console.log("Held transactions:", heldTransactions.length);
        heldTransactions.forEach((t, i) => {
          console.log(
            `[${i}] Nilai: ${t.nilai_mutasi.toLocaleString("id-ID")}, ` +
              `Admin1: "${t.admin1_status || "undefined"}", ` +
              `Admin2: "${t.admin2_status || "undefined"}"`,
          );
        });
        console.log("Total Held Funds:", held.toLocaleString("id-ID"));
      }

      return {
        recentTransactions: recent,
        availableFunds: available,
        heldFunds: held,
        totalSaldoInvestor: available + held,
      };
    }, [transactions]);

  const getAdminBadge = (status: string | undefined, adminNumber: 1 | 2) => {
    if (!status) return { text: "-", color: "#6B7280" }; // gray-500

    const isApproved = status === "APPROVE";
    const isRejected = status === "REJECT";

    if (isApproved) {
      return { text: "Approved", color: "#10B981" }; // green-500
    } else if (isRejected) {
      return { text: "Rejected", color: "#EF4444" }; // red-500
    } else {
      // For PROSES or PENDING
      return {
        text: status,
        color: adminNumber === 1 ? "#F59E0B" : "#FBBF24", // amber-500 for admin1, amber-300 for admin2
      };
    }
  };

  const exportToPDF = async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      // Create PDF - Landscape mode for more columns
      const pdf = new jsPDF("l", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add logo
      try {
        const logoResponse = await fetch("/light.png");
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        pdf.addImage(logoBase64, "PNG", pageWidth - 40, 10, 30, 30);
      } catch (error) {
        console.warn("Logo not found, continuing without logo");
      }

      // Title
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Laporan Mutasi Transaksi", 20, 25);

      // Period
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      const periodText = `Periode: ${threeMonthsAgo.toLocaleDateString(
        "id-ID",
      )} - ${new Date().toLocaleDateString("id-ID")}`;
      pdf.text(periodText, 20, 35);

      // Investor Info
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Informasi Investor", 20, 50);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Kode: ${investor.kode}`, 20, 68);
      pdf.text(`Nama: ${investor.nama}`, 20, 60);
      pdf.text(`Email: ${investor.email}`, 20, 76);
      pdf.text(`Rekening: ${investor.rekening_bank}`, 20, 84);
      pdf.text(`A/n Rekening: ${investor.atas_nama_rekening}`, 20, 92);

      // Summary with better formatting
      pdf.setFillColor(249, 250, 251); // bg-gray-50
      pdf.rect(105, 55, 140, 40, "F");

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      // Dana Tersedia
      pdf.text("Dana Tersedia:", 110, 65);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(availableFunds),
        200,
        65,
        { align: "right" },
      );

      // Dana Ditahan
      pdf.setFont("helvetica", "normal");
      pdf.text("Dana Ditahan:", 110, 75);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(heldFunds),
        200,
        75,
        { align: "right" },
      );

      // Total
      pdf.setFont("helvetica", "bold");
      pdf.text("Total Saldo Investor:", 110, 85);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(totalSaldoInvestor),
        200,
        85,
        { align: "right" },
      );

      // Note about Dana Ditahan
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.text(
        "*Dana Ditahan adalah transaksi yang belum di-APPROVE oleh Admin1 atau Admin2",
        110,
        95,
      );

      // Transactions Table - matching UserDashboard layout
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Detail Transaksi ", 20, 115);

      let yPosition = 125;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      // Table headers matching UserDashboard columns
      const headers = [
        "Tanggal",
        "Jenis Mutasi",
        "Nilai Mutasi",
        "Saldo Rill",
        "Keterangan",
        "Admin 1",
        "Admin 2",
      ];

      const columnWidths = [25, 25, 30, 30, 45, 25, 25];
      let xPosition = 20;

      // Draw header background
      pdf.setFillColor(243, 244, 246); // bg-gray-100
      pdf.rect(20, yPosition - 4, pageWidth - 40, 8, "F");

      headers.forEach((header, index) => {
        if (index === 2 || index === 3) {
          pdf.text(header, xPosition + columnWidths[index] - 2, yPosition, {
            align: "right",
          });
        } else {
          pdf.text(header, xPosition, yPosition);
        }
        xPosition += columnWidths[index];
      });

      // Draw header bottom line
      pdf.setDrawColor(229, 231, 235); // gray-200
      pdf.line(20, yPosition + 2, pageWidth - 20, yPosition + 2);

      pdf.setFont("helvetica", "normal");
      yPosition += 8;

      let pageNumber = 1;

      for (let i = 0; i < recentTransactions.length; i++) {
        const transaction = recentTransactions[i];

        if (yPosition > pageHeight - 30) {
          // Add page number
          pdf.setFontSize(8);
          pdf.text(`Halaman ${pageNumber}`, pageWidth / 2, pageHeight - 10, {
            align: "center",
          });
          pageNumber++;

          // New page
          pdf.addPage();
          yPosition = 30;

          // Redraw headers on new page
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");

          // Draw header background
          pdf.setFillColor(243, 244, 246);
          pdf.rect(20, yPosition - 4, pageWidth - 40, 8, "F");

          xPosition = 20;
          headers.forEach((header, index) => {
            if (index === 2 || index === 3) {
              pdf.text(header, xPosition + columnWidths[index] - 2, yPosition, {
                align: "right",
              });
            } else {
              pdf.text(header, xPosition, yPosition);
            }
            xPosition += columnWidths[index];
          });

          pdf.line(20, yPosition + 2, pageWidth - 20, yPosition + 2);
          pdf.setFont("helvetica", "normal");
          yPosition += 8;
        }

        xPosition = 20;

        // Format date like in UserDashboard: day/month/year
        const date = new Date(transaction.tanggal);
        const day = date.getDate();
        const month = date.toLocaleDateString("id-ID", { month: "short" });
        const year = date.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        // Format mutasi badge
        const mutasi = transaction.mutasi;

        // Format currency
        const formattedNilai = new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(transaction.nilai_mutasi);

        const formattedSaldo = new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(transaction.saldo_akhir);

        // Get admin badge styles
        const admin1Badge = getAdminBadge(transaction.admin1_status, 1);
        const admin2Badge = getAdminBadge(transaction.admin2_status, 2);

        const rowData = [
          formattedDate,
          mutasi,
          formattedNilai,
          formattedSaldo,
          transaction.keterangan || "-",
          admin1Badge.text,
          admin2Badge.text,
        ];

        // Draw row with alternating background
        if (i % 2 === 0) {
          pdf.setFillColor(249, 250, 251); // gray-50
          pdf.rect(20, yPosition - 3, pageWidth - 40, 6, "F");
        }

        rowData.forEach((data, idx) => {
          const text = data.toString();
          const maxWidth = columnWidths[idx] - 2;

          // Truncate if too long
          let displayText = text;
          if (pdf.getTextWidth(text) > maxWidth) {
            displayText = text.substring(0, 10) + "...";
          }

          // Set color for admin badges
          if (idx === 5) {
            // Admin 1
            pdf.setTextColor(
              parseInt(admin1Badge.color.slice(1, 3), 16),
              parseInt(admin1Badge.color.slice(3, 5), 16),
              parseInt(admin1Badge.color.slice(5, 7), 16),
            );
          } else if (idx === 6) {
            // Admin 2
            pdf.setTextColor(
              parseInt(admin2Badge.color.slice(1, 3), 16),
              parseInt(admin2Badge.color.slice(3, 5), 16),
              parseInt(admin2Badge.color.slice(5, 7), 16),
            );
          } else {
            pdf.setTextColor(0, 0, 0);
          }

          if (idx === 2 || idx === 3) {
            pdf.text(
              displayText,
              xPosition + columnWidths[idx] - 2,
              yPosition,
              { align: "right" },
            );
          } else {
            pdf.text(displayText, xPosition + 1, yPosition);
          }
          xPosition += columnWidths[idx];
        });

        // Reset text color
        pdf.setTextColor(0, 0, 0);
        yPosition += 6;
      }

      // Add final page number
      pdf.setFontSize(8);
      pdf.text(`Halaman ${pageNumber}`, pageWidth / 2, pageHeight - 10, {
        align: "center",
      });

      // Save PDF
      const fileName = `mutasi-${investor.kode}-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(
        `Gagal membuat PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Silakan coba lagi.`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={exportToPDF}
      variant="outline"
      size="sm"
      disabled={isExporting}
    >
      <Download
        className={`mr-2 h-4 w-4 ${isExporting ? "animate-pulse" : ""}`}
      />
      {isExporting ? "Membuat PDF..." : "Export PDF"}
    </Button>
  );
}
