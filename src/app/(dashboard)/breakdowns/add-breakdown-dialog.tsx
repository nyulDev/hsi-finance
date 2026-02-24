"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function AddBreakdownDialog() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [formData, setFormData] = useState({
    kode: "",
    project_pt: "",
    keterangan: "",
    nilai: "",
    tempo: "60",
    bagi_hasil: "",
    hari: "",
    bagi_hasil_per_bulan: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      const fetchNextKode = async () => {
        try {
          const response = await fetch("/api/breakdowns?action=lastKode");
          const data = await response.json();
          const lastKode = data.lastKode;
          let nextNumber = 1;
          if (lastKode && lastKode.startsWith("BRK-")) {
            const lastNumber = parseInt(lastKode.split("-")[1]);
            nextNumber = lastNumber + 1;
          }
          const nextKode = `BRK-${nextNumber.toString().padStart(3, "0")}`;
          setFormData((prev) => ({ ...prev, kode: nextKode }));
        } catch (error) {
          console.error("Error fetching next kode:", error);
        }
      };
      fetchNextKode();
    }
  }, [open]);

  const calculateFields = (tanggal: Date | undefined, nilai: string) => {
    const nilaiValue = parseFloat(nilai) || 0;
    const bagiHasilValue = (nilaiValue * 0.05).toFixed(2);

    let hariValue = "";
    let bagiHasilPerBulanValue = "";

    if (tanggal) {
      // Calculate hari: last day of month - input date
      const year = tanggal.getFullYear();
      const month = tanggal.getMonth();
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      const inputDate = tanggal.getDate();
      const hari = lastDayOfMonth - inputDate;
      hariValue = hari.toString();

      // Calculate bagi_hasil_per_bulan: (hari / tempo) * bagi_hasil
      const tempo = 60;
      const bagiHasilPerBulan = (hari / tempo) * parseFloat(bagiHasilValue);
      bagiHasilPerBulanValue = bagiHasilPerBulan.toFixed(2);
    }

    return {
      bagi_hasil: bagiHasilValue,
      hari: hariValue,
      bagi_hasil_per_bulan: bagiHasilPerBulanValue,
    };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "nilai") {
      const calculated = calculateFields(date, value);
      setFormData({
        ...formData,
        nilai: value,
        ...calculated,
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      alert("Silakan pilih tanggal");
      return;
    }

    setLoading(true);
    try {
      // Fetch the latest kode right before submitting to avoid race conditions
      let finalKode = formData.kode;
      try {
        const kodeResponse = await fetch("/api/breakdowns?action=lastKode");
        const kodeData = await kodeResponse.json();
        const lastKode = kodeData.lastKode;
        let nextNumber = 1;
        if (lastKode && lastKode.startsWith("BRK-")) {
          const lastNumber = parseInt(lastKode.split("-")[1]);
          nextNumber = lastNumber + 1;
        }
        finalKode = `BRK-${nextNumber.toString().padStart(3, "0")}`;
        console.log("Using kode:", finalKode, "(refreshed before submit)");
      } catch (kodeError) {
        console.error("Error fetching latest kode:", kodeError);
      }

      const response = await fetch("/api/breakdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          kode: finalKode,
          tanggal: date.toISOString(),
        }),
      });

      if (response.ok) {
        setOpen(false);
        setDate(undefined);
        setFormData({
          kode: "",
          project_pt: "",
          keterangan: "",
          nilai: "",
          tempo: "60",
          bagi_hasil: "",
          hari: "",
          bagi_hasil_per_bulan: "",
        });
        router.refresh(); // Refresh the page to show new data
      } else {
        const error = await response.json();
        alert(error.error || "Gagal menambahkan breakdown");
      }
    } catch (error) {
      console.error("Error adding breakdown:", error);
      alert("Gagal menambahkan breakdown");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Breakdown</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tambah Breakdown Baru</DialogTitle>
          <DialogDescription>
            Isi detail untuk menambahkan breakdown baru.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <Label htmlFor="kode">Kode</Label>
            <Input id="kode" name="kode" value={formData.kode} disabled />
          </div>

          <div>
            <Label>Tanggal</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (
                    format(date, "PPP", { locale: localeId })
                  ) : (
                    <span>Pilih tanggal</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => {
                    setDate(newDate);
                    if (newDate && formData.nilai) {
                      const calculated = calculateFields(
                        newDate,
                        formData.nilai,
                      );
                      setFormData({ ...formData, ...calculated });
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="project_pt">Project PT</Label>
            <Input
              id="project_pt"
              name="project_pt"
              value={formData.project_pt}
              onChange={handleChange}
              placeholder="Masukkan Project PT"
              required
            />
          </div>

          <div>
            <Label htmlFor="keterangan">Keterangan</Label>
            <Input
              id="keterangan"
              name="keterangan"
              value={formData.keterangan}
              onChange={handleChange}
              placeholder="Keterangan breakdown"
            />
          </div>

          <div>
            <Label htmlFor="nilai">Nilai (Rp)</Label>
            <Input
              id="nilai"
              name="nilai"
              type="number"
              step="0.01"
              value={formData.nilai}
              onChange={handleChange}
              placeholder="0"
              required
            />
          </div>

          <div>
            <Label htmlFor="tempo">Tempo (Hari)</Label>
            <Input id="tempo" name="tempo" type="number" value="60" disabled />
            <p className="text-xs text-muted-foreground mt-1">
              Tempo tetap 60 hari
            </p>
          </div>

          <div>
            <Label htmlFor="bagi_hasil">Bagi Hasil (5% dari Nilai)</Label>
            <Input
              id="bagi_hasil"
              name="bagi_hasil"
              type="text"
              value={
                formData.bagi_hasil
                  ? `Rp ${parseFloat(formData.bagi_hasil).toLocaleString(
                      "id-ID",
                    )}`
                  : "Rp 0"
              }
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              Otomatis dihitung: Nilai × 5%
            </p>
          </div>

          <div>
            <Label htmlFor="hari">Hari</Label>
            <Input
              id="hari"
              name="hari"
              type="text"
              value={formData.hari ? `${formData.hari} hari` : "-"}
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              Otomatis dihitung: Akhir bulan - Tanggal input
            </p>
          </div>

          <div>
            <Label htmlFor="bagi_hasil_per_bulan">Bagi Hasil / Bulan</Label>
            <Input
              id="bagi_hasil_per_bulan"
              name="bagi_hasil_per_bulan"
              type="text"
              value={
                formData.bagi_hasil_per_bulan
                  ? `Rp ${parseFloat(
                      formData.bagi_hasil_per_bulan,
                    ).toLocaleString("id-ID")}`
                  : "Rp 0"
              }
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              Otomatis dihitung: (Hari ÷ Tempo) × Bagi Hasil
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Menambahkan..." : "Tambah Breakdown"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
