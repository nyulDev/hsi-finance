"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/TablePagination";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowSelection?: {};
  setRowSelection?: React.Dispatch<React.SetStateAction<{}>>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  rowSelection: externalRowSelection,
  setRowSelection: externalSetRowSelection,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [searchText, setSearchText] = useState("");

  const currentRowSelection = externalRowSelection ?? rowSelection;
  const currentSetRowSelection = externalSetRowSelection ?? setRowSelection;

  const filteredData = useMemo(
    () =>
      data.filter(
        (item) =>
          (item as any).nama
            ?.toLowerCase()
            .includes(searchText.toLowerCase()) ||
          (item as any).kode?.toLowerCase().includes(searchText.toLowerCase()),
      ),
    [data, searchText],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: currentSetRowSelection,
    state: {
      sorting,
      rowSelection: currentRowSelection,
    },
  });

  console.log(table);
  return (
    <div className="rounded-md border overflow-x-auto">
      {/* <div className="flex items-center justify-center py-4">
        <Input
          placeholder="Search by name..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          className="max-w-sm"
        />
      </div> */}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} />
    </div>
  );
}
