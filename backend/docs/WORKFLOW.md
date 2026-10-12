# Order workflow rules

Single source of truth: `src/config/workflow.js` (frontend mirror: `frontend/src/constants/workflow.js`).

## Sales order lifecycle

```
CREATED → DESIGN_IN_REVIEW / DESIGN_QUERY → DESIGN_APPROVED → BOM_SUBMITTED → BOM_APPROVED
→ QUOTATION_SENT → PROCUREMENT / MATERIAL_PURCHASE_IN_PROGRESS → MATERIAL_READY
→ IN_PRODUCTION → PRODUCTION_COMPLETED → QC_IN_PROGRESS / QC_REJECTED → QC_APPROVED
→ READY_FOR_SHIPMENT → PARTIALLY_SHIPPED → SHIPPED → DELIVERED → CLOSED      (CANCELLED: any time before shipping)
```

- Before `IN_PRODUCTION` any design / quotation / procurement loop is allowed.
- From `IN_PRODUCTION` onward an order only moves forward, except the rework loop
  (production ↔ QC ↔ ready for shipment) while nothing has shipped.
- `CLOSED` and `CANCELLED` are final.
- **User actions** call `assertSalesOrderTransition(from, to)`: an invalid move returns HTTP 409 with a message.
- **Automatic side effects** (PO created, plan created, QC passed, quotation re-sent) use
  `salesOrderAdvanceSql(to)` in the `WHERE` clause: if the order is already further along,
  the update is skipped instead of moving it backwards.
- Payment progress lives in `sales_orders.payment_status` / `paid_amount` (UNPAID / PARTIAL / PAID),
  never in `status`, so an advance payment doesn't take an order out of production or shipping queues.

## Who moves the order

| Event | Status set | Where |
|---|---|---|
| Production plan created | IN_PRODUCTION | productionPlanService |
| All work orders of the order completed | PRODUCTION_COMPLETED | jobCardService `markSalesOrderProductionCompleted` |
| Final QC passed / failed (recorded in `final_qc_inspections`) | READY_FOR_SHIPMENT / QC_REJECTED | finalQCService |
| Dispatch job card releases qty | READY_FOR_SHIPMENT + FG stock IN (`PRODUCTION_OUTPUT`) | jobCardService `postFinishedGoodsToStock` |
| Shipment DISPATCHED / DELIVERED | PARTIALLY_SHIPPED / SHIPPED / DELIVERED (by dispatched qty) | shipmentService `syncSalesOrderShippingStatus` |

## Edit / delete locks

| Document | Locked when |
|---|---|
| Sales order items | production started, or plans / work orders / shipments exist (use **Cancel**: `POST /sales-orders/:id/cancel`) |
| Sales order delete | production started, or work orders / shipments / payments exist |
| Customer PO items | goods dispatched against linked orders |
| Customer PO delete | linked orders in production, shipped, or paid |
| Purchase order delete | receipts / GRN, vendor invoice, or payments exist |
| PO lines | a payment exists; qty can't go below already received |
| PO → FULFILLED / CLOSED | everything received, or `shortClose: true` with a reason |
| PO receipt / GRN / QC delete | stock already posted from it |
| Production plan delete | job cards started or material requests processed |
| Shipment delete | after DISPATCHED |

## Money

- Receipts (`customer_payments`) and vendor payments (`payments`) run in one transaction with their
  receipt/voucher and ledger rows, reject amounts above the outstanding balance, and reverse ledger + order
  payment status when deleted or marked FAILED.
- Ledger convention: customer receipts and vendor payments are **CREDIT** entries.
- Vendor invoice verification does a 3-way check (vendor bill vs PO rate × GRN qty, 1% / ₹10 tolerance);
  a larger difference needs `override: true` and a reason.
- Document numbers (PO, delivery challan, receipt, voucher) come from `utils/documentNumber.js`
  (`document_sequences` table, row-locked) so concurrent saves can't duplicate a number.

## One-off scripts (dry run by default, `--apply` to write)

- `migrations/026-workflow-hardening-data.js`: fixes old DEBIT receipt ledger rows, back-fills `net_total` and payment status.
- `migrations/027-role-permission-matrix.js`: proposed least-privilege role permissions (today every role has every permission).
