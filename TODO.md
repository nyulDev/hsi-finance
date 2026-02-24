# TODO - Perbaiki Export PDF Rekap

## Plan

- [ ] Update export-pdf-button.tsx untuk menyertakan semua kolom yang ada di table:
  - Kode
  - Nama
  - Saldo Tersedia
  - Dana Ditahan
  - Total Saldo
  - Rekening Bank
  - WA

- [ ] Update page.tsx untuk passing data summary yang benar ke ExportPdfButton

## Perubahan yang diperlukan:

1. export-pdf-button.tsx:
   - Tambah field `totalDanaDitahan` dan `totalInvestorSaldo` ke interface
   - Tambah kolom "Dana Ditahan" di table PDF
   - Ganti kolom "Saldo Akhir" menjadi "Saldo Tersedia" dan "Total Saldo"
   - Fix use of correct field names: saldo, dana_ditahan, saldo_akhir_calculated

2. page.tsx:
   - Update passing summary ke ExportPdfButton untuk menyertakan totalDanaDitahan dan totalInvestorSaldo
