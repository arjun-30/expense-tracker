# Schema Migration Notes — ERP Full Schema Expansion

Reconciliation of the existing `schema.prisma` (original scope-of-work) against the
new ~44-table ERP design (Foundation / Finance / Operations / Procurement /
Management). Written **before** `schema.prisma` was touched, per task instructions.

This document is the source of truth for every rename/replace/drop/net-new decision
made in the new schema. Items under **OPEN QUESTION** are things this task did
**not** resolve — they need a human decision before any Neon migration or seed/app
rework happens.

---

## 0. Cross-cutting decisions (apply to the whole schema)

### 0.1 Primary key format: `String @id @default(uuid())`, not native `@db.Uuid`
The design says "every table: UUID primary key." The existing schema uses
`String @id @default(cuid())`. I kept the **column type as plain `String`** (Prisma's
`uuid()` default generator, not PostgreSQL's native `uuid` column type / `@db.Uuid`).

**Why:** existing rows (in Neon and any populated local db) have `cuid()`-format IDs
(e.g. `cjld2cyuq0000t3rmniod1foy`), which are **not valid UUID strings**. If the ID
columns were changed to native `@db.Uuid`, Postgres would reject those existing values
outright during migration. Keeping `String` means only the *default generator* for new
rows changes (cuid → uuid); existing values remain valid, no data loss, no forced
backfill. New rows created after this migration will have real UUID-format IDs.

**OPEN QUESTION:** if strict native `uuid` typing (`@db.Uuid`) is actually required
(e.g. for storage efficiency or stricter validation), existing cuid-format IDs across
every table would need to be converted to UUIDs first (rewriting all FKs). Flagging
this rather than silently picking the stricter option, since it's materially more
disruptive to any existing Neon data.

### 0.2 Enum value casing
The design document writes enum values in lowercase (`draft`, `submitted`, `cash`...).
The **existing schema uses UPPER_SNAKE_CASE** enum values throughout (`DRAFT`,
`SUBMITTED`, `CASH`...), and the coding standards for this task say to match the
existing schema's naming conventions. I kept UPPER_SNAKE_CASE for all enum values
(new and reused), since the value *sets* are otherwise identical to the design's and
this is purely a casing convention already established in the codebase. The
underlying Postgres enum type names still follow the exact snake_case names the
design lists (`payment_method`, `expense_status`, etc.) via `@@map`.

### 0.3 Multi-tenancy (`companies`) is being introduced from scratch
The current app is **single-tenant** — no `companies` table, no `company_id` anywhere.
The new design makes nearly every table carry `company_id NOT NULL` (directly or via
parent FK). This is the single biggest structural change in this migration.

**Consequence for Neon:** every existing row in every company-scoped table
(`users`, `departments`, `vendors`, `vehicles`, `machines`, `expenses`, ...) will need
a `company_id` backfilled to *some* company before the `NOT NULL` constraint can be
applied. Locally this is a non-issue (fresh db). Against Neon this requires either:
  - creating one "default" company row and backfilling every existing row to it, or
  - some other business decision if there's a reason to actually split data across
    real companies.

**OPEN QUESTION:** confirm a single default company is correct for the existing Neon
data (7 seeded users, no real production data yet, per earlier migration work) before
this schema is ever applied there.

### 0.4 RBAC cutover: `Role` enum → `roles` / `permissions` / `user_roles` / `role_permissions`
The existing schema authorizes via a single scalar `User.role Role` enum
(`SUPER_ADMIN`, `ADMIN`, `ACCOUNTS`, `PURCHASE_MANAGER`, `MAINTENANCE_MANAGER`,
`TRANSPORT_MANAGER`, `EMPLOYEE`). The new design has **no scalar role field on
users at all** — authorization is fully data-driven via `roles`, `permissions`,
`role_permissions`, and `user_roles` (many-to-many, explicit join model).

I implemented the new design exactly as specified: the `Role` enum and `User.role`
column are **removed**, replaced by the four new tables.

**Consequence:** this is a hard cutover, not an additive change. All existing
application code that reads `user.role` (auth middleware, page guards, seed script)
will break — expected per the task brief ("do not implement application logic," "some
tests will fail"). See §7 for the list of affected tests.

**OPEN QUESTION:** for the 7 existing seeded Neon users, each currently has exactly
one `Role` enum value. Migrating them means: (1) creating one `Role` row per legacy
enum value (e.g. `SUPER_ADMIN` → a `roles` row named `SUPER_ADMIN` under the default
company), and (2) creating a `user_roles` row linking each user to their mapped role.
This is a mechanical 1:1 transform but still needs confirmation before running against
Neon (not done in this task — local db is fresh/empty so it's moot there).

### 0.5 CHECK constraints — not natively supported by Prisma 7.9.1
Empirically confirmed: `@@check(...)` is not a recognized attribute in this Prisma
version (`npx prisma validate` → `P1012: Attribute not known: "@check"`). All listed
CHECK constraints are therefore added as raw SQL, appended to the generated migration
file via `prisma migrate dev --create-only`, documented in full in §6 below — none are
skipped silently.

### 0.6 `created_at`/`updated_at` on tables where the per-table listing didn't repeat it
The design's "Conventions" section states as a blanket rule: every table gets
`created_at`, and mutable tables also get `updated_at`. Several individual table
listings (e.g. `expense_categories`, `expense_subcategories`, `cost_centers` in some
places, `permissions`) don't explicitly re-list these columns, which I read as the
document not repeating a rule it already stated once, not as those specific tables
being exempt. I applied the blanket convention everywhere **except**: (a) tables
explicitly marked append-only (`audit_logs`, `consumable_stock_movements` — single
timestamp only, no `updated_at`, since nothing about them should ever be "updated"),
and (b) the explicit-join tables (`role_permissions`, `user_roles`) which only carry
their one named timestamp (`granted_at`/`assigned_at`) as specified. `permissions` is
genuinely static reference data (no `is_active`, no timestamps requested anywhere) so
it was left with no timestamps at all.

### 0.7 Naming convention
Prisma model names: PascalCase (existing convention). Prisma field names: camelCase.
Actual DB table/column names: snake_case, applied via `@@map` / `@map`, matching the
design's snake_case names exactly (`expense_number`, `company_id`, etc.) — same
pattern the design uses and the same underlying convention Prisma's default cuid-based
schema here already followed loosely (existing schema didn't use `@@map` since
Prisma's default camelCase-to-column mapping happened to look fine before; the new
schema is explicit about it since the design mandates exact snake_case table/column
names).

---

## 1. FOUNDATION module

| Design table | Existing model | Decision |
|---|---|---|
| `companies` | — | **Net new.** No existing counterpart. Bootstraps multi-tenancy (§0.3). |
| `roles` | `Role` enum | **Replaces.** Enum removed; became a real table, company-scoped. (§0.4) |
| `permissions` | — | **Net new.** |
| `role_permissions` | — | **Net new**, explicit join model (not implicit m-n) per spec, carries `granted_at`. |
| `departments` | `Department` | **Mapped**, extended with `company_id`. Uniqueness changes from global `code`/`name` to `@@unique([companyId, code])` — global uniqueness dropped in favor of per-company. |
| `cost_centers` | `CostCenter` | **Mapped**, extended with `company_id`. Same uniqueness change as departments. |
| `users` | `User` | **Mapped**, extended with `company_id` (NOT NULL — see §0.3), `role` enum field **removed** (see §0.4). Added `failed_login_attempts`, `locked_until`, password reset fields all already existed and map 1:1. |
| `user_roles` | — | **Net new**, explicit join model, carries `assigned_at`. |
| `sessions` | — | **Net new.** No existing session table — the app currently signs stateless JWTs (`jose` is a dependency), so there's nothing to backfill; this table starts empty. Whether the app should start persisting sessions here is an app-logic decision, out of scope for this task. |

---

## 2. FINANCE module

| Design table | Existing model | Decision |
|---|---|---|
| `expense_categories` | `ExpenseCategory` (self-referencing tree, `parentId`) | **Split.** The design has two *separate* flat tables (`expense_categories`, `expense_subcategories`) instead of one self-referencing tree. Existing rows where `parentId IS NULL` → `expense_categories`; rows where `parentId IS NOT NULL` → `expense_subcategories`, FK'd to the *new* parent row's id. **OPEN QUESTION:** this is a real data transform, not just a rename — needs to run against actual Neon category data before that migration, not assumed here. |
| `expense_subcategories` | (see above) | **Split out of** `ExpenseCategory`. |
| `vendors` | `Vendor` | **Mapped**, extended with `company_id`. `VendorStatus` enum (`ACTIVE`/`INACTIVE`) → `is_active BOOLEAN` per spec (straightforward `ACTIVE→true`, `INACTIVE→false`). |
| `expenses` | `Expense` | **Mapped**, extended with `company_id`. `category`/`subcategory` now FK the two split tables instead of one self-referencing table. **Fields dropped** (not in the new design): `paymentStatus`, `approvedById`, `approvedAt`, `remarks` — approval history is fully represented via `expense_approvals` already, so this is a de-duplication, not a data loss, **provided** every approval that previously only updated those fields was also recorded as an `ExpenseApproval` row. **OPEN QUESTION:** confirm the app always wrote a matching `ExpenseApproval` row alongside setting `approvedById`/`approvedAt`, or that data is lost. New CHECK: `total_amount = amount + tax_amount − discount_amount` (§6). |
| `expense_attachments` | `ExpenseAttachment` | **Mapped.** `fileUrl` → `storage_key` (rename, same semantic — assumes the app already stores an object-storage key rather than a full URL; if `fileUrl` currently holds full URLs, that's a value-format change, not just a column rename — **OPEN QUESTION**). `fileSize Int` → `file_size_bytes BIGINT` (widened). |
| `approval_rules` | — | **Net new.** No existing configurable approval-threshold table; approvals were presumably hardcoded in app logic before. |
| `expense_approvals` | `ExpenseApproval` | **Mapped**, but adds a new required `approval_level INT NOT NULL` column that didn't exist before. **OPEN QUESTION:** existing `ExpenseApproval` rows have no `approval_level` — needs a backfill default (e.g. `1`) before the NOT NULL constraint can apply against Neon. |
| `payments` | `Payment` | **Mapped**, extended with `company_id` and a new nullable `expense_id` FK (didn't exist before — `Payment` was only linked to `Invoice`, see below). `invoiceId` FK **dropped** because the design has no `invoices` table at all (see §2 note below). `bank` field dropped (not in spec). |
| — | `Invoice` | **NO COUNTERPART IN THE NEW DESIGN.** The 44-table design has no invoices table whatsoever — `payments` links directly to `expense_id`/`vendor_id`, nothing else references an invoice. **OPEN QUESTION (important):** does invoicing functionality get dropped entirely, or is `Invoice` intentionally out of scope of this particular design doc and should be preserved as an extra table beyond the 44? I did **not** silently drop `Invoice` — see §7 for what I actually did (kept it, unmapped, flagged). This also affects `PurchaseOrder.invoices` reverse relation and `Vendor.invoices`. |
| `notifications` | `Notification` | **Mapped**, extended with `company_id`. Scalar `role Role?` field → `role_id UUID FK->roles.id` — tied to the RBAC cutover (§0.4); same backfill dependency. |
| `audit_logs` | `AuditLog` | **Mapped**, extended with `company_id`. `module` → `entity_type`, `recordId` → `entity_id`, but **tightened to NOT NULL** (was nullable before). **OPEN QUESTION:** if any existing `AuditLog` row has `recordId IS NULL`, it will violate the new NOT NULL constraint — needs a placeholder value or the constraint needs relaxing before Neon migration. |

---

## 3. OPERATIONS module

| Design table | Existing model | Decision |
|---|---|---|
| `vehicles` | `Vehicle` | **Mapped**, extended with `company_id`. **Restructured:** `insuranceExpiry`, `pollutionExpiry`, `fitnessExpiry` (three scalar date fields) are **replaced** by the new generic `vehicle_documents` table (one row per document type, with `valid_from`/`valid_until`). Direct `driverId` FK on `Vehicle` also **dropped** — driver assignment now only exists per-transaction (`fuel_transactions.driver_id`) / per-trip (`transport_trips.driver_id`), not as a standing vehicle↔driver assignment. **OPEN QUESTION:** both of these are real data-migration work for any populated Neon vehicle rows (convert 3 expiry columns → up to 3 `vehicle_documents` rows each; decide what happens to the standing driver assignment, since there's no direct equivalent). |
| `drivers` | `Driver` | **Mapped**, extended with `company_id`. |
| `vehicle_documents` | — | **Net new** (absorbs the 3 expiry fields, see above). |
| `fuel_transactions` | `FuelTransaction` | **Mapped.** Dropped fields not in spec: `costPerKm`, `remarks`, `paymentMethod`. `billUrl` → `bill_storage_key` (rename, same caveat as expense attachments re: URL vs storage key). New CHECK: `odometer_reading >= previous_odometer_reading` (§6). |
| `transporters` | — | **Net new**, but **overlaps with `vendors`.** Existing schema currently models transporters *as* `Vendor` rows (`TransportTrip.transporterId` FKs `Vendor`). The new design introduces a wholly separate `transporters` table. **OPEN QUESTION (explicitly not resolved, per task instruction):** should `transporters` be merged into `vendors` (e.g. a `vendors.category = 'transporter'` convention, which the existing `Vendor.category` free-text field already sort of supports), or kept fully separate as the design specifies? I implemented it exactly as designed — separate table — but existing `TransportTrip` rows that currently point at a `Vendor` row have **no automatic equivalent** `Transporter` row to point to instead. This needs a human decision (and possibly a data backfill script creating `Transporter` rows from existing transporter-like `Vendor` rows) before Neon migration. |
| `transport_trips` | `TransportTrip` | **Mapped.** `transporterId` now FKs the new `transporters` table instead of `vendors` (see above). Dropped fields not in spec: `numberOfTrips`, `parking`, `otherCharges`, `costPerKg`, `invoiceUrl`. |
| `machines` | `Machine` | **Mapped**, extended with `company_id`. `purchasePrice` → `purchase_cost` (rename). Dropped fields not in spec: `category`, `warrantyExpiry`, `expectedLifespanMonths`. |
| `machine_documents` | — | **Net new** (generic document storage for machines, analogous to `vehicle_documents`). |
| `maintenance_requests` | — | **Net new upstream stage.** Existing `MaintenanceRecord.problem` (free text) plus its ad-hoc `status String @default("OPEN")` field are the closest existing analogs, but the design formally splits "someone reported a problem" (`maintenance_requests`, with `priority`/`status`) from "the work that was actually done" (`maintenance_records`). |
| `maintenance_records` | `MaintenanceRecord` | **Mapped**, but restructured: `problem` moves to the new `maintenance_requests.problem_description` (upstream table); `status`, `invoiceUrl`, `remarks`, `nextMaintenanceDate` **dropped** from the record itself — `nextMaintenanceDate` is superseded by the new, decoupled `maintenance_schedules` table (a recurring schedule per machine, not a single next-date per record). `sparePartsCost` → `consumables_cost` (rename). `maintenance_request_id` is a new **nullable** FK back to the upstream request (nullable because not every maintenance record necessarily started from a formal request). |
| `maintenance_schedules` | — | **Net new**, decoupled recurring-schedule concept; no direct existing counterpart to migrate from (old `nextMaintenanceDate` was per-record, one-shot, not a recurring schedule). |
| `consumables` | `SparePart` | **Renamed/mapped**, extended with `company_id`. `purchasePrice` → `unit_cost` (rename). `SparePartStatus` enum (`ACTIVE`/`DISCONTINUED`) → `is_active BOOLEAN` (same transform pattern as vendors). **Fields dropped:** `description`, and — importantly — `supplierId` (direct default-vendor FK on the spare part). The new design has no default-supplier concept on `consumables` at all (supplier is only ever per-purchase-order). |
| `consumable_stock_movements` | `InventoryTransaction` | **Renamed/mapped.** `type` → `movement_type`, but the **enum value set changed**: `REPLACEMENT` is **removed**, `TRANSFER` is **added** (design's exact list: purchase, issue, return, adjustment, transfer, damaged, scrap). **OPEN QUESTION:** any existing `InventoryTransaction` rows with `type = REPLACEMENT` have no direct new-enum equivalent — needs a remap decision (closest candidates are probably `ADJUSTMENT` or `ISSUE`+`RETURN` pair, but that's a judgment call, not guessed here). Also: the design explicitly specifies `quantity` is now **signed** (+inbound / −outbound), where the existing `InventoryTransaction.quantity` appears to have been stored as an unsigned magnitude with the sign implied by `type`. **OPEN QUESTION:** this is a semantic/value change, not just a rename — existing historical rows would need their `quantity` sign corrected based on their `type` before this new convention is trustworthy. `receivedById` field dropped (not in spec). The polymorphic `reference_type`/`reference_id` columns are new (see §5 for the "no FK, intentional" note) — this is also the closest new-design analog for what `MaintenanceSpare` used to do directly (see below). |
| `consumable_usage` | — (no direct predecessor; see `MaintenanceSpare` below) | **Net new**, links a stock movement to what consumed it (machine/department/cost-center + quantity + date). |
| — | `MaintenanceSpare` | **NO DIRECT COUNTERPART.** The old join table (maintenance record ↔ spare part, with `quantity`/`unitCost`/`totalCost`/`issuedBy`/`receivedBy`) has no equivalent table in the new design. The closest fit is: each old `MaintenanceSpare` row becomes one `consumable_stock_movements` row (`movement_type = ISSUE`, `reference_type = 'maintenance_record'`, `reference_id = <old maintenance record id>`) **plus** possibly a `consumable_usage` row. **OPEN QUESTION (important, not resolved here):** the exact transform is a judgment call — I'm flagging the closest-fit mapping, not implementing a silent data migration for it. |
| — | `SparePartMachine` (spare↔machine compatibility, m-n) | **NO COUNTERPART.** The new design has no "which consumables are compatible with which machines" table at all. **OPEN QUESTION:** confirm this is intentionally out of scope for the new design (compatibility tracking dropped) rather than an oversight — I did not add a substitute table since it isn't in spec, and did not silently drop the *concept* from this notes doc either. |

---

## 4. PROCUREMENT module

| Design table | Existing model | Decision |
|---|---|---|
| `purchase_requests` | — | **Net new upstream stage.** No existing "request before order" concept — the old flow went straight to `PurchaseOrder`. |
| `purchase_request_items` | — | **Net new.** |
| `purchase_orders` | `PurchaseOrder` | **Mapped**, extended with `company_id` and a new nullable `purchase_request_id` (nullable since the upstream stage is retrofitted — any existing PO has no request to point back to, which is fine since it's nullable). `actualDelivery` field dropped (not in spec). |
| `purchase_order_items` | `PurchaseOrderItem` | **Mapped.** `sparePartId` → `consumable_id` (follows the `SparePart`→`consumables` rename). New CHECK: `received_quantity <= quantity` (§6). |
| `goods_receipts` | — | **Net new formalization.** Previously `receivedQuantity` on `PurchaseOrderItem` was presumably just incremented by app logic with no receipt-level audit trail (who received it, when, as a discrete event). |
| `goods_receipt_items` | — | **Net new**, same reasoning; links back to `purchase_order_items` and optionally to the stock-movement ledger entry it generated. |

---

## 5. MANAGEMENT module

| Design table | Existing model | Decision |
|---|---|---|
| `budgets` | `Budget` | **Mapped**, extended with `company_id`. `periodStart`/`periodEnd` narrowed from `DateTime` (timestamptz) to `DATE` per spec — minor precision change, low risk (time-of-day was presumably always irrelevant for a budget period boundary). `amount` → `total_amount` (rename). **Restructured:** the old model held `departmentId`/`categoryId`/`costCenterId` directly; the new design moves that breakdown into the child `budget_allocations` table (a budget can now have *multiple* allocations). New CHECK: `period_end > period_start` (§6). |
| `budget_allocations` | — | **Net new child table**, but a clean 1:1 transform is available: each existing `Budget` row's `departmentId`/`categoryId`/`costCenterId`/`amount` can become exactly one `budget_allocations` row under the new parent `budgets` row (`total_amount` = old `amount`, one allocation row = old amount again). **OPEN QUESTION:** confirm this 1-allocation-per-old-budget default is acceptable before running it against real Neon budget data (not done in this task). |
| `report_jobs` | — | **Net new.** No existing async report-generation infrastructure. |
| `notification_rules` | `AlertRule` | **Renamed/mapped**, extended with `company_id`. `description` and `module` fields dropped (not in spec). `key` unique constraint carries over directly. |

---

## 6. CHECK constraints — implemented via raw SQL (Prisma 7.9.1 has no native `@@check`)

Confirmed empirically: `npx prisma validate` rejects `@@check(...)` with
`P1012: Attribute not known: "@check"`. Every constraint below is therefore added by
hand-editing the generated migration's `migration.sql` (via
`prisma migrate dev --create-only`) rather than skipped. Exact SQL used:

```sql
-- expenses: total must equal amount + tax - discount
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_total_amount_check"
  CHECK ("total_amount" = "amount" + "tax_amount" - "discount_amount");

-- expenses: non-negative money fields
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_nonneg_check"
  CHECK ("amount" >= 0);
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tax_amount_nonneg_check"
  CHECK ("tax_amount" >= 0);
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_discount_amount_nonneg_check"
  CHECK ("discount_amount" >= 0);

-- approval_rules: max_amount, if set, must be >= min_amount
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_max_ge_min_check"
  CHECK ("max_amount" IS NULL OR "max_amount" >= "min_amount");

-- payments: amount must be strictly positive
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive_check"
  CHECK ("amount" > 0);

-- vehicles: odometer non-negative
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_current_odometer_nonneg_check"
  CHECK ("current_odometer" >= 0);

-- fuel_transactions: litres strictly positive
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_litres_positive_check"
  CHECK ("litres" > 0);

-- fuel_transactions: distance travelled non-negative
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_distance_nonneg_check"
  CHECK ("distance_travelled" >= 0);

-- fuel_transactions: current odometer reading can't be before the previous one
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_odometer_order_check"
  CHECK ("odometer_reading" >= "previous_odometer_reading");

-- consumable_usage: quantity strictly positive
ALTER TABLE "consumable_usage" ADD CONSTRAINT "consumable_usage_quantity_positive_check"
  CHECK ("quantity" > 0);

-- purchase_request_items: quantity strictly positive
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "pr_items_quantity_positive_check"
  CHECK ("quantity" > 0);

-- purchase_order_items: received quantity can't exceed ordered quantity
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "po_items_received_le_quantity_check"
  CHECK ("received_quantity" <= "quantity");

-- goods_receipt_items: quantity received strictly positive
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "gr_items_quantity_positive_check"
  CHECK ("quantity_received" > 0);

-- budgets: period_end must be after period_start
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_period_end_after_start_check"
  CHECK ("period_end" > "period_start");

-- budget_allocations: allocated amount non-negative
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_amount_nonneg_check"
  CHECK ("allocated_amount" >= 0);
```

These were appended to the bottom of the generated migration's `migration.sql` file
(see §8) — the migration was created with `--create-only`, the SQL above was appended,
then applied with a plain `migrate dev` (no further prompt), all against **local
Docker Postgres only**.

---

## 7. What happened to tables the new design doesn't mention at all

Not silently dropped. Kept in `schema.prisma`, unchanged, pending a human decision:

- **`Invoice`** — no counterpart in the new design at all (§2). Kept as-is. `Payment`
  no longer FKs it (design's `payments` table has no `invoice_id`), so `Invoice` is
  now an orphaned model relationship-wise once `payments.invoiceId` is removed — I
  removed that specific FK (since `payments` had to match the design exactly) but left
  `Invoice` itself and its `Vendor`/`PurchaseOrder` relations intact.
- **`Settings`** — generic key/value config table, no design counterpart. Kept as-is.
- **`SparePartMachine`** — spare/consumable ↔ machine compatibility join table, no
  design counterpart (§3). Kept as-is, now pointing at `Machine`/`SparePart` (the old
  models), since there's no `consumables`-side equivalent to repoint it to without
  inventing something outside the spec.
- **`MaintenanceSpare`** — old maintenance-record ↔ spare-part usage join, no direct
  design counterpart (§3, closest-fit noted). Kept as-is.
- **`ProductionOrder` / `ProductionExpense` / `PrintingExpense`** — already marked
  `// Deferred (schema-ready, no UI this phase)` in the existing schema, and not
  mentioned anywhere in the new 44-table design either. **Recommend removal** as part
  of this cutover (they were never wired to any UI), but **not removed** in this task
  — per the instruction not to silently drop tables that might hold data, and I can't
  verify from the schema alone whether Neon has any rows in them. Needs explicit
  confirmation.

None of the above were required by the task's list of ~44 tables to implement, so
leaving them in place (rather than guessing whether to delete or fold them into new
tables) is the non-destructive default until a human decides.

---

## 8. Local migration

Generated and applied **against local Docker Postgres only**
(`postgresql://mecs:mecs_dev_password@localhost:5437/mecs`, from `docker-compose.yml`)
via a shell-level env override — `.env` (which points at Neon) was **never modified
or read for this step**. See the main report for the exact commands and output.

**Neon was not touched** — no command in this task ran against `DATABASE_URL`/
`DIRECT_URL` as configured in `.env`.

---

## 9. `prisma/seed.ts` — explicitly NOT updated in this task

The seed script still assumes the old schema (`User.role` scalar enum, no
`company_id` anywhere, `SparePart` instead of `consumables`, etc.) and will not run
against the new schema as-is. This is a required, separate follow-up task — flagged
here per instructions, not attempted.

---

## 10. Summary of open questions requiring a human decision before Neon migration

1. Default-company bootstrap strategy for backfilling `company_id` everywhere (§0.3).
2. RBAC data migration: legacy `Role` enum values → `roles`/`user_roles` rows (§0.4).
3. `ExpenseCategory` self-referencing tree → split `expense_categories` /
   `expense_subcategories` transform (§2).
4. Whether `Expense.approvedById`/`approvedAt`/`remarks` data is fully recoverable
   from existing `ExpenseApproval` rows before those columns are dropped (§2).
5. `expense_attachments.storage_key` / `fuel_transactions.bill_storage_key`: are
   existing `fileUrl`/`billUrl` values already object-storage keys, or full URLs that
   need reformatting (§2, §3)?
6. **`Invoice` model has no home in the new design at all** — keep as a permanent
   extra table, or is invoicing meant to be dropped/replaced by something not yet
   specified (§2, §7)?
7. `expense_approvals.approval_level` backfill value for existing rows (§2).
8. `audit_logs.entity_id` tightened to NOT NULL — any existing NULL `recordId` rows
   need a placeholder or the constraint needs relaxing (§2).
9. `vehicles`: convert 3 scalar expiry fields → `vehicle_documents` rows; decide what
   happens to the dropped standing `Vehicle.driverId` assignment (§3).
10. **`transporters` vs `vendors` overlap — explicitly not resolved.** Merge, or keep
    separate as designed and backfill `Transporter` rows from transporter-like
    `Vendor` rows (§3)?
11. `consumable_stock_movements`: remap existing `REPLACEMENT`-type rows (enum value
    removed); correct the sign of existing `quantity` values under the new
    signed-quantity convention (§3).
12. `MaintenanceSpare` → closest-fit transform into `consumable_stock_movements` +
    `consumable_usage` is not implemented, only proposed (§3).
13. `SparePartMachine` (consumable↔machine compatibility) has no new-design
    counterpart — confirm intentional (§3).
14. `budget_allocations`: confirm the proposed 1-allocation-per-old-budget default
    transform (§5).
15. Remove `ProductionOrder`/`ProductionExpense`/`PrintingExpense` as part of this
    cutover, or leave them (§7)?
16. PK format: plain `String @id @default(uuid())` vs native `@db.Uuid` (§0.1).
