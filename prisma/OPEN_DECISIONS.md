# Open Decisions — ERP Database Redesign

This document exists so the two of you — no coding background required — can read
through every unresolved question from the database redesign, discuss it, and record
your decision, without needing to open any code files or understand database syntax.

Nothing further happens until you've worked through this. Specifically: the live
production database (a cloud database called **Neon** — think of it as the "real"
version of the app's data, as opposed to the private copy used for testing) will not
be touched, the data-loading script won't be rewritten, and the rest of the app won't
be updated to match the new database structure, until the **BLOCKING** section below
is fully filled in.

Every question below is written to be readable without any technical background. Any
term that can't be avoided is explained in parentheses the first time it's used.

---

## How to use this document

Each item has:
- **What needs deciding** — the question in plain terms.
- **Why it matters** — what goes wrong, or stays ambiguous, if nobody answers it.
- **Blocking?** — whether this must be settled before the live database can be
  updated, or whether it can wait.
- **Options** — the realistic choices, each with a one-line trade-off. These are
  presented neutrally — none is being recommended over the others.
- **Decision** and **Decided by / date** — blank fields for you to fill in once you've
  talked it through.

---

## BLOCKING — must resolve before touching the live (Neon) database

These 11 items either would cause the update to fail outright against the live
database's existing data, or would silently lose real data if skipped.

### Decision 1: Which "company" does existing data belong to?
**What needs deciding:** The app is being changed to support multiple companies using
it at once (multi-tenant), even though right now it's only ever been used by one. Every
piece of existing data — every user, expense, vehicle, vendor, etc. — will need to be
labeled as belonging to a specific company before the new structure can be applied.
**Why it matters:** If this isn't decided, the update cannot run at all — every record
would need a company label, and there's currently no company to assign it to.
**Blocking?** BLOCKING
**Options:**
  - Option A: Create one "default" company and assign all existing data to it — trade-off: simplest, but assumes there's genuinely only one company's worth of data right now.
  - Option B: Split existing data across more than one real company first — trade-off: more accurate if the data actually represents multiple companies, but requires someone to manually sort out which record belongs to which company before anything else can happen.
**Decision:** Option A. Single company only. One default `Company` row is created (placeholder name "Plastic Manufacturing Co", flagged for the project owner to rename later) and every seeded record's `company_id` points to it.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 2: How do existing user permission levels carry over to the new system?
**What needs deciding:** Right now, each user has one fixed "role" label (like Admin,
Accounts, Purchase Manager). The new system replaces this with a more flexible
permissions setup — roles become their own editable list, and users can be assigned
one or more of them. The 7 existing users need their current role converted into this
new format.
**Why it matters:** Without this, none of the 7 existing users would have any
permissions at all under the new system — nobody could log in and do anything until
this conversion happens.
**Blocking?** BLOCKING
**Options:**
  - Option A: Auto-convert each user's current single role into an equivalent new-style role, 1-for-1 — trade-off: fast and preserves current access exactly, but doesn't take advantage of the new system's flexibility (e.g. giving someone two roles at once).
  - Option B: Have someone manually re-assign permissions for each of the 7 users using the new, more granular system — trade-off: more accurate/intentional, but requires manual review time before anyone can log in normally.
**Decision:** Neither A nor B exactly — manual rebuild, not a blind 1-for-1 conversion. The 7 role names are recreated as rows in `roles` with a hand-picked starter permission set per role via `role_permissions` (e.g. ACCOUNTS gets expense/payment permissions, PURCHASE_MANAGER gets procurement permissions). The `user_roles` join is many-to-many so a user could hold multiple roles in future, even though each of the 7 seed users gets exactly one role today.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 3: How should existing expense categories be split into categories and subcategories?
**What needs deciding:** Right now, expense categories and their subcategories are
stored together in one flexible list (a category can be "under" another category, to
any depth). The new design uses two clearly separate lists instead: one for top-level
categories, one for subcategories. The existing categories need to be sorted into
these two lists.
**Why it matters:** This is a real, one-time data reshuffle — not just a rename. If
it's not done carefully, categories could end up misclassified or duplicated,
which affects every expense that references them.
**Blocking?** BLOCKING
**Options:**
  - Option A: Auto-convert based on the current structure — anything that's currently a "top-level" category becomes a category, anything "underneath" another becomes a subcategory — trade-off: fast and consistent, but relies on the current data actually being organized cleanly, which should be checked first.
  - Option B: Have someone manually review and re-sort categories/subcategories before the conversion runs — trade-off: more accurate, but takes real time and someone with knowledge of what the categories should look like.
**Decision:** Option A. Confirmed max 2 levels in practice. Top-level categories become `expense_categories` rows; anything nested under a parent becomes an `expense_subcategories` row linked to it.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 4: Will we lose any expense approval history when we simplify the expenses table?
**What needs deciding:** Each expense currently stores who approved it, when, and any
comments, directly on the expense record itself. The new design removes those fields
from the expense record and relies entirely on a separate approval-history list to
hold that information instead. We need to confirm that separate list already has a
complete, matching entry for every expense that was ever approved — before we remove
the fields on the expense record itself.
**Why it matters:** If the separate approval-history list is missing entries for some
older expenses, removing the fields from the expense record would permanently lose
that "who approved this and when" information for those expenses.
**Blocking?** BLOCKING
**Options:**
  - Option A: Check the approval-history records against the expense records first, and only proceed once confirmed complete — trade-off: safest, but requires someone to run/review that check before moving forward.
  - Option B: Proceed on the assumption the approval-history list is already complete and accept that any gaps are old/acceptable losses — trade-off: faster, but risks permanently losing approval details for some past expenses with no way to recover them later.
**Decision:** Option B. All current data (including the ~90 expenses and ~168 approvals) is demo/seed data with nothing real at risk, so no completeness audit was run — proceeding straight to a clean reseed under the new schema.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 5: Do we keep, replace, or drop the "Invoice" (vendor billing document) feature?
**What needs deciding:** The current system has a full "Invoice" feature — tracking a
vendor's bill separately from the payment made against it. The new database design
doesn't include this concept at all — it only tracks payments directly, with no
invoice step in between. We need to decide whether invoices are being intentionally
dropped as a feature, or whether they should be kept even though the new design
doesn't call for them.
**Why it matters:** This affects whether invoice records and the invoice feature
continue to exist and be usable going forward, or whether that functionality quietly
disappears from the app.
**Blocking?** BLOCKING
**Options:**
  - Option A: Keep invoices as an extra, standalone feature alongside the new design — trade-off: preserves current functionality, but means the database won't perfectly match the new design document, and invoices become disconnected from payments (a payment can no longer be linked back to a specific invoice).
  - Option B: Drop the invoice feature entirely, matching the new design exactly — trade-off: perfectly matches the new design, but removes a feature that's currently in active use, and any existing invoice records become historical-only (not usable going forward).
**Decision:** Option B. Invoicing is removed entirely — no `Invoice` model in the new schema. `payments` link directly to `expenses` and `vendors` only, with no invoice step in between.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 6: What approval "level" should be assigned to past expense approvals?
**What needs deciding:** The new design adds a required "approval level" number
(e.g., level 1, level 2) to every entry in the approval-history list, to support
multi-step approval chains. None of the existing, already-recorded approvals have this
number — a value has to be assigned to every one of them before the update can be
applied.
**Why it matters:** Every existing approval-history entry needs a value here to be
valid under the new structure — without picking a default, the live database can't be
updated because these entries would be incomplete.
**Blocking?** BLOCKING
**Options:**
  - Option A: Assign every existing approval a default level of 1 — trade-off: simple and fast, but treats all past approvals as single-step, even ones that may have actually involved multiple approval steps.
  - Option B: Manually review past approvals and assign the correct level to each based on what actually happened — trade-off: more historically accurate, but is manual work proportional to how many approval records exist (168 as of the last check).
**Decision:** Option A. All approval data is demo/seed data, so regenerated/seeded approval records get a default `approval_level` of 1 rather than attempting historical reconstruction.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 7: Do all existing activity-log entries have a specific record attached, or could some be blank?
**What needs deciding:** The system keeps an activity log (audit trail) of who did
what and when. Each log entry is supposed to point to the specific record it relates
to (e.g., "this log entry is about Expense #123"). The new design makes that link a
required field. We need to confirm none of the existing log entries have that field
left blank.
**Why it matters:** If any existing log entry has this left blank, the update can't
be applied as-is — those entries would need either a placeholder value or the
requirement would need to be relaxed.
**Blocking?** BLOCKING
**Options:**
  - Option A: Check existing log entries for blanks first; if none are found, no further action needed — trade-off: safest, low effort if the check comes back clean.
  - Option B: If blanks are found, fill them in with a generic placeholder rather than a real record link — trade-off: unblocks the update quickly, but those specific log entries become less useful/traceable going forward.
**Decision:** Neither check was needed. Since all data is demo/seed data, no historical audit log preservation is required — the new seed script generates fresh, fully-populated audit log entries going forward; no blank-field remediation needed on old data.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 8: How do we handle vehicle insurance/fitness/pollution expiry dates and driver assignments under the new structure?
**What needs deciding:** Right now, each vehicle record directly stores three expiry
dates (insurance, fitness certificate, pollution certificate) and, separately, which
driver is assigned to it. The new design replaces the three expiry dates with a more
flexible "vehicle documents" list (so any number of document types/expiries can be
tracked, not just those three), and removes the standing driver-to-vehicle assignment
entirely (drivers are instead recorded per fuel fill-up and per trip, not as a
permanent vehicle assignment).
**Why it matters:** If existing vehicles' expiry dates aren't converted into the new
document list, that information is lost. And there's currently no equivalent place to
preserve "which driver is normally assigned to this vehicle" once that field is
removed — that information would simply disappear unless something is done about it.
**Blocking?** BLOCKING
**Options:**
  - Option A: Auto-convert each vehicle's existing expiry dates into the new document list format, and simply drop the standing driver assignment (since fuel/trip records will capture drivers going forward anyway) — trade-off: preserves the expiry-date history automatically, but loses the "default driver per vehicle" information with no replacement.
  - Option B: Same as Option A for expiry dates, but also keep a note of each vehicle's current driver somewhere (e.g., in a document or spreadsheet) in case it's needed later — trade-off: doesn't lose the information, but requires someone to do that recordkeeping manually since the new database has no field for it.
**Decision:** Option A. Existing vehicle insurance/fitness/pollution expiry fields auto-convert into `vehicle_documents` rows (one row per document type per vehicle). No standing "default driver per vehicle" field is preserved anywhere — confirmed not needed; drivers are only recorded per `fuel_transactions` and `transport_trips` going forward.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 9: Are "transporters" the same thing as "vendors," or genuinely separate?
**What needs deciding:** Currently, transport companies (who move goods/materials) are
recorded using the same list as regular vendors/suppliers. The new design introduces a
completely separate list just for transporters. We need to decide whether to actually
keep them separate going forward, or treat this as one and the same thing that
shouldn't have been split.
**Why it matters:** If kept separate as designed, every existing transport trip that
currently points to a "vendor" record needs to be re-pointed to a new, matching
"transporter" record — and right now, no such matching records exist, so this has to
be sorted out before anything involving trips or transporters can work correctly on
the live database.
**Blocking?** BLOCKING
**Options:**
  - Option A: Keep them fully separate as the new design specifies, and create a matching "transporter" record for each vendor that's currently being used as a transporter — trade-off: cleaner long-term separation of concerns, but requires someone to identify which existing vendors are actually transporters and duplicate them into the new list.
  - Option B: Merge the idea back together — treat transporters as just a category/tag within the existing vendor list, rather than a separate list — trade-off: no duplication needed and matches how the data is organized today, but moves away from the new design as written.
**Decision:** Option A. Transporters are confirmed NOT vendors and are kept fully separate — the standalone `transporters` table is implemented exactly as designed. Since this is demo data, fresh `transporters` records are seeded directly rather than migrating any existing vendor-as-transporter data.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 10: How do we handle old inventory transaction types that no longer exist in the new system?
**What needs deciding:** The system tracks a running history of parts/consumables
moving in and out of stock, each tagged with a type (e.g., "purchase," "issue,"
"return"). One of the existing tags — "replacement" — doesn't exist in the new design
at all (it's being replaced with a different tag, "transfer," which means something
different). Any existing history entries tagged "replacement" need to be re-tagged as
something else. Separately, the new design also expects stock quantities to be
recorded as positive (stock added) or negative (stock removed) — the current system
doesn't consistently do this, so old entries may need their numbers corrected too.
**Why it matters:** If old "replacement"-tagged entries aren't re-tagged, the update
would fail for those specific records since that tag category no longer exists. If the
positive/negative correction isn't done, stock history reports could show
misleading numbers going forward.
**Blocking?** BLOCKING
**Options:**
  - Option A: Re-tag all "replacement" entries as "adjustment" (the closest general-purpose category), and correct the positive/negative signs based on what type of transaction each entry was — trade-off: keeps all historical data, but requires someone to review and correctly reclassify each affected record.
  - Option B: Leave old "replacement" entries as historical/read-only records in a separate archive rather than converting them, and don't attempt to correct old sign values — trade-off: much less manual work, but historical stock-movement reports may be incomplete or slightly inaccurate for older data.
**Decision:** Neither — since this is demo data, no historical re-tagging is needed. The new seed script generates fresh `consumable_stock_movements` records using only the new, correct movement types (purchase, issue, return, adjustment, transfer, damaged, scrap) with correct positive/negative signs from the start.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 11: How should we split old, single-line budgets into the new "budget + allocation" structure?
**What needs deciding:** Currently, a budget is one record that directly states which
department, category, and cost center it applies to. The new design splits this into
two levels: a parent "budget" (the overall total) and one or more "allocations" under
it (breaking that total down by department/category/cost center). Existing budgets
need to be converted into this two-level structure.
**Why it matters:** If this conversion isn't done thoughtfully, the department/category
breakdown information currently attached directly to each budget could be lost when
budgets are restructured.
**Blocking?** BLOCKING
**Options:**
  - Option A: Auto-convert each existing budget into one parent budget with exactly one matching allocation underneath (carrying over the same department/category/cost center and the same total amount) — trade-off: simple, automatic, and loses nothing, but doesn't take advantage of the new ability to split one budget across multiple departments/categories.
  - Option B: Have someone manually re-build budgets using the new two-level structure, potentially splitting some old single-line budgets into multiple allocations where that makes more sense — trade-off: more accurate and takes advantage of the new flexibility, but requires manual budget-by-budget review.
**Decision:** Option A. Each existing/seeded budget converts to one parent `budgets` row with exactly one matching `budget_allocations` row underneath it (same department/category/cost center, same total amount) — confirmed sufficient, no multi-department budgets needed at this time.
**Decided by / date:** Project owner + original developer, 2026-09-02.

---

## NON-BLOCKING — can be decided later

These 5 items don't stop the live database from being updated — they affect
future features, data cleanliness, or app behavior, and can be decided at a
more convenient time without holding anything else up.

### Decision 12: Are our uploaded file references stored as web addresses or internal file codes?
**What needs deciding:** Files (like receipt photos or fuel bills) attached to
records are referenced by a text value. The new design assumes this value is always
an internal storage code, but the current system may have been storing full web
addresses (links) instead. We need to confirm which one it actually is.
**Why it matters:** If the values are currently full web links but the new design
treats them as internal codes, existing file attachments might not display or open
correctly until this is sorted out. This doesn't stop the database update itself —
it's a data-quality/display question for later.
**Blocking?** NON-BLOCKING
**Options:**
  - Option A: Confirm the values are already internal codes (no change needed) — trade-off: nothing to do, assuming this is actually the case.
  - Option B: If they're full web links, write a small follow-up fix to convert them to the new format — trade-off: extra follow-up work, but only needed if Option A turns out to be false.
**Decision:** No action needed in this task — left as already implemented in the existing ERP schema draft (flexible ID approach, `storage_key` convention already correct per the original design).
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 13: How do we record historical "spare parts used in a repair" entries in the new inventory system?
**What needs deciding:** Currently, there's a dedicated record type for "this repair
used these spare parts, issued by this person." The new design doesn't have a direct
equivalent — instead, parts usage would be tracked through the same general stock
history and usage lists used for everything else. We haven't yet decided exactly how
old repair-parts records should be represented in that more general system.
**Why it matters:** This affects how cleanly historical repair-parts data connects to
future reporting, but doesn't block anything — the old records are being kept as-is
in the meantime, so nothing is at risk of being lost while this is decided.
**Blocking?** NON-BLOCKING
**Options:**
  - Option A: Leave the old repair-parts records exactly as they are, permanently, as a historical record type — trade-off: zero extra work, but historical repair-parts usage won't show up in the newer, more general reports.
  - Option B: Eventually convert old repair-parts records into the new general stock-history format — trade-off: unifies all historical data into one consistent system, but is a real project to plan and execute later.
**Decision:** Option A for now. The `maintenance_spares` table (renamed/mapped from the old `MaintenanceSpare` model, FK renamed to `consumable_id`) is kept as a standalone historical record type, not folded into `consumable_stock_movements`/`consumable_usage`. Not part of the new design's ~44-table count, but not dropped either since no explicit decision to drop it was made.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 14: Should we keep tracking which spare parts/consumables are compatible with which machines?
**What needs deciding:** The current system has a feature for marking "this spare
part fits this machine." The new design doesn't include this feature at all. We need
to confirm whether this was an intentional decision to drop it, or whether it should
be added back in.
**Why it matters:** If it's genuinely not needed going forward, nothing further is
required. If it is still wanted, it needs to be added to the design before that part
of the app is built — but it doesn't affect anything else in the meantime.
**Blocking?** NON-BLOCKING
**Options:**
  - Option A: Confirm this feature is intentionally being dropped — trade-off: simplest, but means staff will no longer be able to look up which parts fit which machines through the system.
  - Option B: Keep the feature and add it into the new design later as a small addition — trade-off: preserves useful functionality, but is extra design/development work to schedule.
**Decision:** Option A. Confirmed unused — no `SparePartMachine`-equivalent table in the new schema. The old `spare_part_machines` join table is removed entirely.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 15: Do we keep or remove three old, unused "production tracking" record types?
**What needs deciding:** There are three record types in the system (production
orders, production expenses, printing expenses) that were built for a possible future
feature but were never actually connected to any screen in the app — nobody has ever
used them through the app itself. They're not mentioned anywhere in the new design.
We need to decide whether to remove them or leave them in place.
**Why it matters:** These aren't used anywhere today, so this is a pure housekeeping
decision — it doesn't affect anything else, but leaving unused things around forever
does add a small amount of ongoing clutter/confusion.
**Blocking?** NON-BLOCKING
**Options:**
  - Option A: Remove them, since they were never actually used — trade-off: cleaner going forward, but should only be done after confirming there's genuinely no data sitting in them worth keeping.
  - Option B: Leave them in place for now — trade-off: no risk either way, but the clutter remains.
**Decision:** Option A. Confirmed unused (never wired to any UI) — `ProductionOrder`, `ProductionExpense`, and `PrintingExpense` are removed entirely from the schema.
**Decided by / date:** Project owner + original developer, 2026-09-02.

### Decision 16: Should record ID numbers be strictly formatted, or flexible?
**What needs deciding:** Every record in the database has a unique ID. The new
design calls for these to follow a strict, standardized format (called a UUID — a
very specific 36-character pattern). For technical compatibility with existing data,
this task used a more flexible approach that accepts the new strict format for new
records while still allowing the old-style IDs already in use to keep working. The
open question is whether to eventually convert everything to the strict format, which
would require rewriting every existing ID.
**Why it matters:** This is purely a technical tidiness question — the flexible
approach already in place works correctly today and doesn't cause any errors or data
loss. Switching to the strict format later is optional and would only matter for
technical consistency, not for the app working correctly.
**Blocking?** NON-BLOCKING
**Options:**
  - Option A: Leave it as the flexible approach already in place — trade-off: zero extra work, fully functional, just not perfectly "by the book" internally.
  - Option B: Do a one-time cleanup project later to convert every existing ID to the strict format — trade-off: technically cleaner, but a nontrivial, carefully-tested project since every single reference between records would need updating at the same time.
**Decision:** Option A. No action needed in this task — left as-is (flexible `String @id @default(uuid())` approach already implemented in the existing ERP schema draft).
**Decided by / date:** Project owner + original developer, 2026-09-02.

---

## What happens after this is filled in

Once every item in the **BLOCKING** section above has a recorded decision, the
following three follow-up pieces of work happen, in this order:

1. **Rewrite the data-loading script** (`seed.ts`) — the script that sets up sample/
   starter data (like the initial user accounts) gets updated to match the new
   structure and the decisions recorded above.
2. **Update the rest of the app** — every screen, form, and background process that
   currently relies on the old database structure gets updated to work with the new
   one (this is the bulk of the actual coding work).
3. **Apply the new structure to the live (Neon) database** — only after the two steps
   above are done and tested is the new structure actually applied to the real,
   live database that the app runs on day-to-day.

The **NON-BLOCKING** items can be discussed and decided at any point before or during
this process — they don't hold up step 1, 2, or 3 above.
