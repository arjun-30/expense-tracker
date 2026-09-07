-- Expense workflow full replacement: DRAFT/SUBMITTED/UNDER_REVIEW/APPROVED/
-- REJECTED/PAID/CANCELLED -> SUBMITTED/APPROVAL_PENDING/APPROVED/REVIEWED/
-- REJECTED/PAID (invoice-presence-gated). See prisma/OPEN_DECISIONS.md.
--
-- Postgres can't DROP a value from an enum type directly, so removing
-- DRAFT/UNDER_REVIEW/CANCELLED (and VERIFIED/CANCELLED from approval_action)
-- requires the standard swap: create a new type with the target value set,
-- cast every column using that type across to it, rename, drop the old type.
-- That cast fails outright (Postgres raises "invalid input value for enum")
-- if any existing row still holds a value the new type doesn't have — so
-- every such row must be moved to a valid value FIRST, in this same
-- transaction, before the type swap runs.
--
-- Confirmed data-migration decision (see project OPEN_DECISIONS): existing
-- UNDER_REVIEW expenses move to SUBMITTED. No live data anywhere currently
-- uses DRAFT or CANCELLED as expenses.status (verified by direct query
-- before writing this migration), so no mapping was invented for those —
-- if a future environment (e.g. Neon, in the separate follow-up migration)
-- turns out to have rows in either, this migration will fail loudly on the
-- CAST step below rather than silently guessing a mapping, and must be
-- re-examined with that real data before proceeding.
--
-- expense_approvals is a historical audit log, not live state, but its
-- action/from_status/to_status columns are ExpenseStatus/ApprovalAction
-- typed too, so they hit the same cast. Local DB has 91 rows with
-- from_status = 'DRAFT' (logged by the old "submit" transition, DRAFT ->
-- SUBMITTED) and none using VERIFIED/CANCELLED/UNDER_REVIEW anywhere in
-- this table (verified by direct query). DRAFT is cleared to NULL here
-- (from_status is nullable) rather than remapped to a real status, since
-- "the prior status was DRAFT" is simply no longer a representable fact —
-- inventing a replacement value would misstate history.
--
-- Confirmed data-migration decision, added after this migration first ran
-- against Neon (production) and failed: Neon has 11 expense_approvals rows
-- with action = 'VERIFIED' (the old ACCOUNTS "verify" step), which local
-- never had and this migration originally didn't account for. Unlike the
-- from_status = 'DRAFT' case above, "verify" has a direct successor concept
-- in the new model — VERIFIED is remapped to REVIEWED here, not cleared,
-- since both represent the same audit fact: a review/sign-off checkpoint,
-- not a final approval. This mirrors how the analogous legacy APPROVED-
-- status expenses were migrated to REVIEWED rather than left unresolved.

-- Move any UNDER_REVIEW expenses to SUBMITTED (confirmed decision; 0 rows on
-- local, but this must run before the enum swap below regardless).
UPDATE "expenses" SET "status" = 'SUBMITTED' WHERE "status" = 'UNDER_REVIEW';
UPDATE "expense_approvals" SET "to_status" = 'SUBMITTED' WHERE "to_status" = 'UNDER_REVIEW';
UPDATE "expense_approvals" SET "from_status" = 'SUBMITTED' WHERE "from_status" = 'UNDER_REVIEW';

-- Historical DRAFT from_status entries: no successor status to map to, clear.
UPDATE "expense_approvals" SET "from_status" = NULL WHERE "from_status" = 'DRAFT';

-- Historical VERIFIED actions (old ACCOUNTS "verify" step): remapped to
-- REVIEWED, a review/sign-off checkpoint under the new model, not cleared,
-- since it has a direct successor concept (confirmed decision; 0 rows on
-- local, 11 on Neon). Must run before the approval_action enum swap below.
UPDATE "expense_approvals" SET "action" = 'REVIEWED' WHERE "action" = 'VERIFIED';

-- CreateEnum
-- Guarded (not a plain CREATE TYPE): this statement sits before any BEGIN
-- block, so on the first Neon attempt it auto-committed on its own before
-- the later approval_action cast failed and aborted that migration run. A
-- retry of this same file must not error on "already exists" against that
-- partially-applied state, so this is wrapped the standard Postgres way.
DO $$ BEGIN
  CREATE TYPE "attachment_type" AS ENUM ('INVOICE', 'SUPPORTING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum (approval_action: drop VERIFIED, CANCELLED)
BEGIN;
CREATE TYPE "approval_action_new" AS ENUM ('SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED', 'PAID');
ALTER TABLE "expense_approvals" ALTER COLUMN "action" TYPE "approval_action_new" USING ("action"::text::"approval_action_new");
ALTER TYPE "approval_action" RENAME TO "approval_action_old";
ALTER TYPE "approval_action_new" RENAME TO "approval_action";
DROP TYPE "approval_action_old";
COMMIT;

-- AlterEnum (expense_status: drop DRAFT, UNDER_REVIEW, CANCELLED; add APPROVAL_PENDING, REVIEWED)
BEGIN;
CREATE TYPE "expense_status_new" AS ENUM ('SUBMITTED', 'APPROVAL_PENDING', 'APPROVED', 'REVIEWED', 'REJECTED', 'PAID');
ALTER TABLE "expenses" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "expenses" ALTER COLUMN "status" TYPE "expense_status_new" USING ("status"::text::"expense_status_new");
ALTER TABLE "expense_approvals" ALTER COLUMN "from_status" TYPE "expense_status_new" USING ("from_status"::text::"expense_status_new");
ALTER TABLE "expense_approvals" ALTER COLUMN "to_status" TYPE "expense_status_new" USING ("to_status"::text::"expense_status_new");
ALTER TYPE "expense_status" RENAME TO "expense_status_old";
ALTER TYPE "expense_status_new" RENAME TO "expense_status";
DROP TYPE "expense_status_old";
COMMIT;

-- AlterTable: new attachment_type column, defaulting every existing
-- ExpenseAttachment row (none of which are real invoices today) to SUPPORTING.
ALTER TABLE "expense_attachments" ADD COLUMN "attachment_type" "attachment_type" NOT NULL DEFAULT 'SUPPORTING';

-- AlterTable: new hasInvoice flag, defaulting every existing expense to
-- false (none has a real INVOICE-type attachment today).
ALTER TABLE "expenses" ADD COLUMN "has_invoice" BOOLEAN NOT NULL DEFAULT false;
