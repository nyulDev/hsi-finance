# TODO: Match Modal Card values in Investments page with Total Investasi in Breakdowns page

## Task Summary

Make the Modal card values in the Investments page show the same values as the Total Investasi card in the Breakdowns page.

## Plan

- [ ] Edit `src/app/(dashboard)/invesments/month-filter.tsx`:
  - Change "Semua" option value from "all" to null
  - Update handleMonthChange to use "null" for all
- [ ] Edit `src/app/(dashboard)/invesments/page.tsx`:
  - Change filter logic from `month !== "all"` to `month !== "null"`
  - Change default effectiveMonth to show all data

## Changes Made

- [ ]
