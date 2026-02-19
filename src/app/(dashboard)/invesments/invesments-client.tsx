"use client";

import { Investment, columns } from "./columns";
import { DataTable } from "./data-table";
import { AddInvesmentDialog } from "./add-invesment-dialog";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import React from "react";
import { MonthFilter } from "./month-filter";

interface InvestmentsClientProps {
  data: Investment[];
  modal: number;
  persenM: number;
  bagiHasil: number;
  persenB: number;
  adminFee: number;
  danaTersedia: number;
  month?: string;
  monthName?: string | null;
}

export function InvestmentsClient({
  data,
  modal,
  persenM,
  bagiHasil,
  persenB,
  adminFee,
  danaTersedia,
  month,
  monthName,
}: InvestmentsClientProps) {
  const [searchText, setSearchText] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState({});
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if today is the last day of the month
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const isEndOfMonth = today.getDate() === lastDayOfMonth.getDate();

  const filteredData = React.useMemo(
    () =>
      data.filter(
        (item: any) =>
          item.kode?.toLowerCase().includes(searchText.toLowerCase()) ||
          item.nama?.toLowerCase().includes(searchText.toLowerCase()),
      ),
    [data, searchText],
  );

  const selectedRows = React.useMemo(() => {
    return Object.keys(rowSelection).filter(
      (key) => (rowSelection as any)[key],
    );
  }, [rowSelection]);

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus ${selectedRows.length} investment yang dipilih?`,
      )
    )
      return;

    try {
      const deletePromises = selectedRows.map((index) => {
        const item = data[parseInt(index)];
        return fetch(`/api/investors/${item.id}`, { method: "DELETE" });
      });

      const responses = await Promise.all(deletePromises);
      const allOk = responses.every((res) => res.ok);

      if (allOk) {
        window.location.reload();
      } else {
        alert("Gagal menghapus beberapa investment.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Terjadi kesalahan.");
    }
  };

  return (
    <div className="">
      <div className="mb-8 px-4 py-2 bg-secondary rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <h1 className="font-semibold">
            {monthName ? `Investments - ${monthName}` : "All Investments"}
          </h1>
          <MonthFilter currentMonth={month} />
          <Input
            placeholder="Cari kode, nama..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="max-w-sm"
          />
          {selectedRows.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Hapus {selectedRows.length} Terpilih
            </Button>
          )}
        </div>
        {/* <AddInvesmentDialog /> */}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-4 mb-8 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Dana Tersedia</CardDescription>
            <CardTitle className="text-lg font-semibold tabular-nums @[250px]/card:text-xl">
              {danaTersedia.toLocaleString("id-ID", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Modal</CardDescription>
            <CardTitle className="text-lg font-semibold tabular-nums @[250px]/card:text-xl">
              {isClient ? (
                modal.toLocaleString("id-ID", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              ) : (
                <span className="text-gray-400">0</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Persen-M</CardDescription>
            <CardTitle className="text-lg font-semibold tabular-nums @[250px]/card:text-xl">
              {persenM.toFixed(2)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Bagi Hasil</CardDescription>
            <CardTitle className="text-lg font-semibold tabular-nums @[250px]/card:text-xl">
              {bagiHasil.toLocaleString("id-ID", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Potongan admin 5%:{" "}
              {adminFee.toLocaleString("id-ID", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Persen-B</CardDescription>
            <CardTitle className="text-lg font-semibold tabular-nums @[250px]/card:text-xl">
              {persenB.toFixed(2)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <DataTable
        columns={columns}
        data={filteredData}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
      />
    </div>
  );
}
