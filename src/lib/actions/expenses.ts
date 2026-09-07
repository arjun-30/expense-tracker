"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission, isAdminRole, ForbiddenError } from "@/lib/rbac";
import { hasPermission } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";
import { ExpenseStatus, ApprovalAction, AttachmentType } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { expenseTotal } from "@/lib/services/calculations";
import { nextSequenceNumber, withSequenceRetry } from "@/lib/services/sequence";
import { checkBudgetThresholds } from "@/lib/services/budget-alerts";
import { getStorageProvider, MAX_UPLOAD_BYTES } from "@/lib/storage";

const expenseSchema = z.object({
  date: z.coerce.date(),
  categoryId: z.string().min(1),
  subcategoryId: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  taxAmount: z.coerce.number().min(0).default(0),
  discountAmount: z.coerce.number().min(0).default(0),
  vendorId: z.string().optional().nullable(),
  departmentId: z.string().min(1),
  costCenterId: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE", "CREDIT"]).optional().nullable(),
  description: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

// Every role can create/submit its own expenses — same as the old
// CREATE_ROLES constant, which listed every Role enum value.
const CREATE_PERMISSIONS = ["expenses.create"];

/** Statuses an expense can still be edited/have its invoice-affecting
 * fields changed in — before any review/approval decision has been made.
 * Replaces the old "only DRAFT is editable" rule now that DRAFT is gone;
 * SUBMITTED and APPROVAL_PENDING are the two "nothing has happened yet"
 * states in the new model. */
const EDITABLE_STATUSES: ExpenseStatus[] = [ExpenseStatus.SUBMITTED, ExpenseStatus.APPROVAL_PENDING];

function extractFormFields(formData: FormData) {
  return {
    date: formData.get("date"),
    categoryId: formData.get("categoryId"),
    subcategoryId: formData.get("subcategoryId") || null,
    amount: formData.get("amount"),
    taxAmount: formData.get("taxAmount") || 0,
    discountAmount: formData.get("discountAmount") || 0,
    vendorId: formData.get("vendorId") || null,
    departmentId: formData.get("departmentId"),
    costCenterId: formData.get("costCenterId") || null,
    paymentMethod: formData.get("paymentMethod") || null,
    description: formData.get("description") || null,
    referenceNumber: formData.get("referenceNumber") || null,
  };
}

export async function createExpenseAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, CREATE_PERMISSIONS);

  const parsed = expenseSchema.safeParse(extractFormFields(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  if (!isAdminRole(session) && data.departmentId !== session.departmentId) {
    return { success: false, error: "You can only file expenses under your own department" };
  }
  const total = expenseTotal(data.amount, data.taxAmount, data.discountAmount);

  const invoiceFile = formData.get("invoiceFile");
  const hasInvoice = invoiceFile instanceof File && invoiceFile.size > 0;
  if (hasInvoice && invoiceFile.size > MAX_UPLOAD_BYTES) {
    return { success: false, error: "Invoice file exceeds 10 MB limit" };
  }

  let storedInvoiceKey: string | null = null;
  if (hasInvoice) {
    try {
      const buffer = Buffer.from(await invoiceFile.arrayBuffer());
      const stored = await getStorageProvider().save(buffer, invoiceFile.name, invoiceFile.type);
      storedInvoiceKey = stored.key;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Invoice upload failed" };
    }
  }

  // Which of the two workflow scenarios this expense follows is decided
  // once, right here, based on whether an invoice was actually attached.
  const initialStatus = hasInvoice ? ExpenseStatus.SUBMITTED : ExpenseStatus.APPROVAL_PENDING;

  const expense = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const expenseNumber = await nextSequenceNumber(tx.expense, "EXP");
      const created = await tx.expense.create({
        data: {
          companyId: session.companyId,
          expenseNumber,
          expenseDate: data.date,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || null,
          amount: data.amount,
          taxAmount: data.taxAmount,
          discountAmount: data.discountAmount,
          totalAmount: total,
          vendorId: data.vendorId || null,
          departmentId: data.departmentId,
          costCenterId: data.costCenterId || null,
          employeeId: session.sub,
          paymentMethod: data.paymentMethod || null,
          description: data.description || null,
          referenceNumber: data.referenceNumber || null,
          status: initialStatus,
          hasInvoice,
        },
      });

      if (hasInvoice && storedInvoiceKey && invoiceFile instanceof File) {
        await tx.expenseAttachment.create({
          data: {
            expenseId: created.id,
            fileName: invoiceFile.name,
            storageKey: storedInvoiceKey,
            fileType: invoiceFile.type,
            fileSizeBytes: BigInt(invoiceFile.size),
            uploadedById: session.sub,
            attachmentType: AttachmentType.INVOICE,
          },
        });
      }

      await tx.expenseApproval.create({
        data: {
          expenseId: created.id,
          approvalLevel: 1,
          action: ApprovalAction.SUBMITTED,
          actedById: session.sub,
          fromStatus: null,
          toStatus: initialStatus,
        },
      });

      return created;
    })
  );

  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Expense", entityId: expense.id, newValue: expense });

  if (initialStatus === ExpenseStatus.SUBMITTED) {
    await notify({
      companyId: session.companyId,
      roleName: ROLES.ADMIN,
      type: "expense_awaiting_approval",
      title: "Expense awaiting approval",
      message: `${expense.expenseNumber} was submitted for review.`,
      entityType: "Expense",
      entityId: expense.id,
    });
  }

  revalidatePath("/expenses");
  return { success: true, id: expense.id };
}

export async function updateExpenseAction(id: string, input: ExpenseInput): Promise<ActionResult> {
  const session = await requireSession();
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Expense not found" };
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    return { success: false, error: "Only expenses awaiting review or approval can be edited" };
  }
  if (existing.employeeId !== session.sub && !isAdminRole(session)) {
    return { success: false, error: "You can only edit your own expenses" };
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  if (!isAdminRole(session) && data.departmentId !== session.departmentId) {
    return { success: false, error: "You can only file expenses under your own department" };
  }
  const total = expenseTotal(data.amount, data.taxAmount, data.discountAmount);

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      expenseDate: data.date,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId || null,
      amount: data.amount,
      taxAmount: data.taxAmount,
      discountAmount: data.discountAmount,
      totalAmount: total,
      vendorId: data.vendorId || null,
      departmentId: data.departmentId,
      costCenterId: data.costCenterId || null,
      paymentMethod: data.paymentMethod || null,
      description: data.description || null,
      referenceNumber: data.referenceNumber || null,
    },
  });

  await audit({ companyId: session.companyId, userId: session.sub, action: "UPDATE", entityType: "Expense", entityId: id, oldValue: existing, newValue: updated });
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { success: true, id };
}

interface TransitionRule {
  from: ExpenseStatus[];
  permission: string;
  to: ExpenseStatus;
  action: ApprovalAction;
  requiresRemarks?: boolean;
}

const TRANSITIONS: Record<string, TransitionRule> = {
  review: {
    from: [ExpenseStatus.SUBMITTED],
    permission: "expenses.review",
    to: ExpenseStatus.REVIEWED,
    action: ApprovalAction.REVIEWED,
  },
  reject: {
    from: [ExpenseStatus.SUBMITTED, ExpenseStatus.APPROVAL_PENDING],
    permission: "expenses.reject",
    to: ExpenseStatus.REJECTED,
    action: ApprovalAction.REJECTED,
    requiresRemarks: true,
  },
  markPaid: {
    from: [ExpenseStatus.REVIEWED],
    permission: "expenses.mark_paid",
    to: ExpenseStatus.PAID,
    action: ApprovalAction.PAID,
  },
  approve: {
    // No-invoice path only. Deliberately re-enters the flow at SUBMITTED
    // rather than resting at APPROVED, so it goes through the exact same
    // Review -> Mark as Paid steps as an expense that had an invoice from
    // the start (see prisma/schema.prisma's ExpenseStatus comment).
    from: [ExpenseStatus.APPROVAL_PENDING],
    permission: "expenses.approve",
    to: ExpenseStatus.SUBMITTED,
    action: ApprovalAction.APPROVED,
  },
};

export async function transitionExpenseAction(
  id: string,
  transition: keyof typeof TRANSITIONS,
  remarks?: string
): Promise<ActionResult> {
  const session = await requireSession();
  const rule = TRANSITIONS[transition];
  if (!rule) return { success: false, error: "Unknown action" };

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return { success: false, error: "Expense not found" };
  if (!rule.from.includes(expense.status)) {
    return { success: false, error: `Cannot ${transition} an expense in status ${expense.status}` };
  }
  if (!hasPermission(session, rule.permission)) {
    throw new ForbiddenError();
  }
  if (rule.requiresRemarks && !remarks?.trim()) {
    return { success: false, error: "A reason is required for this action" };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.expense.update({
      where: { id },
      data: { status: rule.to },
    });
    await tx.expenseApproval.create({
      data: {
        expenseId: id,
        approvalLevel: 1,
        action: rule.action,
        actedById: session.sub,
        fromStatus: expense.status,
        toStatus: rule.to,
        remarks: remarks || null,
      },
    });
    return u;
  });

  await audit({
    companyId: session.companyId,
    userId: session.sub,
    action: `EXPENSE_${transition.toUpperCase()}`,
    entityType: "Expense",
    entityId: id,
    oldValue: { status: expense.status },
    newValue: { status: rule.to },
  });

  if (rule.to === ExpenseStatus.SUBMITTED) {
    // Reached either by the "approve" transition (no-invoice path re-entering
    // the flow) — createExpenseAction fires this same notification directly
    // for the with-invoice path, since that one never goes through this action.
    await notify({
      companyId: session.companyId,
      roleName: ROLES.ADMIN,
      type: "expense_awaiting_approval",
      title: "Expense awaiting approval",
      message: `${expense.expenseNumber} was submitted for review.`,
      entityType: "Expense",
      entityId: id,
    });
  }
  if (rule.to === ExpenseStatus.REJECTED) {
    await notify({
      companyId: session.companyId,
      userId: expense.employeeId,
      type: "expense_rejected",
      title: "Expense rejected",
      message: `${expense.expenseNumber} was rejected — ${remarks}`,
      entityType: "Expense",
      entityId: id,
    });
  }
  if (rule.to === ExpenseStatus.PAID) {
    await notify({
      companyId: session.companyId,
      userId: expense.employeeId,
      type: "expense_paid",
      title: "Expense paid",
      message: `${expense.expenseNumber} has been marked as paid.`,
      entityType: "Expense",
      entityId: id,
    });
    // Finalized spend = PAID only (see FINALIZED constants in dashboard.ts/
    // budgets.ts/vendors.ts) — budget thresholds are checked at the same
    // point an expense actually counts as spend, not when it's merely approved.
    await checkBudgetThresholds({
      companyId: session.companyId,
      departmentId: expense.departmentId,
      categoryId: expense.categoryId,
      costCenterId: expense.costCenterId,
      date: expense.expenseDate,
    });
  }

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { success: true, id: updated.id };
}

export async function uploadAttachmentAction(
  expenseId: string,
  formData: FormData,
  attachmentType: "SUPPORTING" | "INVOICE" = "SUPPORTING"
): Promise<ActionResult> {
  const session = await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File)) return { success: false, error: "No file provided" };
  if (file.size > MAX_UPLOAD_BYTES) return { success: false, error: "File exceeds 10 MB limit" };

  const buffer = Buffer.from(await file.arrayBuffer());
  let stored;
  try {
    stored = await getStorageProvider().save(buffer, file.name, file.type);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload failed" };
  }

  // One invoice per expense, enforced at the application level: a new
  // INVOICE upload replaces any existing one (rather than being rejected)
  // — chosen over rejecting so correcting a wrong invoice file doesn't
  // require a separate delete-then-reupload step.
  if (attachmentType === "INVOICE") {
    const existingInvoice = await prisma.expenseAttachment.findFirst({
      where: { expenseId, attachmentType: AttachmentType.INVOICE },
    });
    if (existingInvoice) {
      await getStorageProvider().delete(existingInvoice.storageKey, existingInvoice.fileType);
      await prisma.expenseAttachment.delete({ where: { id: existingInvoice.id } });
    }
  }

  const attachment = await prisma.expenseAttachment.create({
    data: {
      expenseId,
      fileName: file.name,
      storageKey: stored.key,
      fileType: file.type,
      fileSizeBytes: BigInt(file.size),
      uploadedById: session.sub,
      attachmentType: attachmentType === "INVOICE" ? AttachmentType.INVOICE : AttachmentType.SUPPORTING,
    },
  });

  await audit({ companyId: session.companyId, userId: session.sub, action: "UPLOAD_ATTACHMENT", entityType: "Expense", entityId: expenseId, newValue: { fileName: file.name, attachmentType } });
  revalidatePath(`/expenses/${expenseId}`);
  return { success: true, id: attachment.id };
}

export async function deleteAttachmentAction(attachmentId: string): Promise<ActionResult> {
  const session = await requireSession();
  const attachment = await prisma.expenseAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return { success: false, error: "Attachment not found" };
  if (attachment.uploadedById !== session.sub && !isAdminRole(session)) {
    throw new ForbiddenError();
  }

  await getStorageProvider().delete(attachment.storageKey, attachment.fileType);
  await prisma.expenseAttachment.delete({ where: { id: attachmentId } });
  await audit({ companyId: session.companyId, userId: session.sub, action: "DELETE_ATTACHMENT", entityType: "Expense", entityId: attachment.expenseId, oldValue: { fileName: attachment.fileName } });
  revalidatePath(`/expenses/${attachment.expenseId}`);
  return { success: true };
}
