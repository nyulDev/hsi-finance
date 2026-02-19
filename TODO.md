# TODO - Fix Admin2 Status Display Issue

## Problem:

When ADMIN2 logs in and views a DEBET mutation where admin1_status is still "PROSES", the status shows "Approve Reject" buttons. It should show "PENDING" instead because ADMIN1 hasn't approved yet.

## Root Cause:

In `src/app/history/columns.tsx`, the `canApprove` logic for Admin 2 column doesn't check if admin1_status is "APPROVE" before showing Approve/Reject buttons.

## Fix Plan:

### 1. src/app/history/columns.tsx

- [ ] Fix the canApprove logic in "admin2_approve" column to check if admin1_status is "APPROVE"
- [ ] Update the display logic to show "PENDING" when admin1_status is not "APPROVE"

## Changes:

- Add condition: `record.admin1_status === "APPROVE"` to canApprove logic
- Display "PENDING" badge when admin1_status is "PROSES" and admin2_status is "PENDING"

## Testing:

After fix:

1. Create new DEBET mutation → admin1_status="PROSES", admin2_status="PENDING"
2. Login as ADMIN2 → should see "PENDING" badge (not Approve/Reject)
3. Login as ADMIN1 → approve → admin1_status="APPROVE", admin2_status="PROSES"
4. Login as ADMIN2 → now should see Approve/Reject buttons
