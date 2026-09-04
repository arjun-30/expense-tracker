"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission, isAdminRole, ForbiddenError } from "@/lib/rbac";
import { hasPermission } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";
import { ExpenseStatus, ApprovalAction } from "@/generated/prisma/enums";
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

// Every role can create/submit/cancel its own expenses — same as the old
// CREATE_ROLES constant, which listed every Role enum value.
const CREATE_PERMISSIONS = ["expenses.create"];

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, CREATE_PERMISSIONS);

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  if (!isAdminRole(session) && data.departmentId !== session.departmentId) {
    return { success: false, error: "You can only file expenses under your own department" };
  }
  const total = expenseTotal(data.amount, data.taxAmount, data.discountAmount);

  const expense = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const expenseNumber = await nextSequenceNumber(tx.expense, "EXP");
      return tx.expense.create({
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
          status: ExpenseStatus.DRAFT,
        },
      });
    })
  );

  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Expense", entityId: expense.id, newValue: expense });
  revalidatePath("/expenses");
  return { success: true, id: expense.id };
}

export async function updateExpenseAction(id: string, input: ExpenseInput): Promise<ActionResult> {
  const session = await requireSession();
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Expense not found" };
  if (existing.status !== ExpenseStatus.DRAFT) return { success: false, error: "Only draft expenses can be edited" };
  if (existing.employeeId !== session.sub && !isAdminRole(session)) {
    return { success: false, error: "You can only edit your own draft expenses" };
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
  /** Required unless `ownerOnly` — the permission code that gates this transition. */
  permission?: string;
  to: ExpenseStatus;
  action: ApprovalAction;
  requiresRemarks?: boolean;
  /** Owner of the expense may always perform this transition, in addition to admins. */
  ownerOnly?: boolean;
}

const TRANSITIONS: Record<string, TransitionRule> = {
  submit: {
    from: [ExpenseStatus.DRAFT],
    to: ExpenseStatus.SUBMITTED,
    action: ApprovalAction.SUBMITTED,
    ownerOnly: true,
  },
  review: {
    from: [ExpenseStatus.SUBMITTED],
    permission: "expenses.review",
    to: ExpenseStatus.UNDER_REVIEW,
    action: ApprovalAction.REVIEWED,
  },
  verify: {
    from: [ExpenseStatus.UNDER_REVIEW],
    permission: "expenses.verify",
    to: ExpenseStatus.UNDER_REVIEW,
    action: ApprovalAction.VERIFIED,
  },
  approve: {
    from: [ExpenseStatus.SUBMITTED, ExpenseStatus.UNDER_REVIEW],
    permission: "expenses.approve",
    to: ExpenseStatus.APPROVED,
    action: ApprovalAction.APPROVED,
  },
  reject: {
    from: [ExpenseStatus.SUBMITTED, ExpenseStatus.UNDER_REVIEW],
    permission: "expenses.reject",
    to: ExpenseStatus.REJECTED,
    action: ApprovalAction.REJECTED,
    requiresRemarks: true,
  },
  markPaid: {
    from: [ExpenseStatus.APPROVED],
    permission: "expenses.mark_paid",
    to: ExpenseStatus.PAID,
    action: ApprovalAction.PAID,
  },
  cancel: {
    from: [ExpenseStatus.DRAFT, ExpenseStatus.SUBMITTED],
    to: ExpenseStatus.CANCELLED,
    action: ApprovalAction.CANCELLED,
    ownerOnly: true,
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
  const isOwner = expense.employeeId === session.sub;
  if (rule.ownerOnly) {
    if (!(isOwner || isAdminRole(session))) {
      throw new ForbiddenError();
    }
  } else if (!rule.permission || !hasPermission(session, rule.permission)) {
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
  if (rule.to === ExpenseStatus.APPROVED) {
    await notify({
      companyId: session.companyId,
      userId: expense.employeeId,
      type: "expense_approved",
      title: "Expense approved",
      message: `${expense.expenseNumber} was approved.`,
      entityType: "Expense",
      entityId: id,
    });
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

export async function uploadAttachmentAction(expenseId: string, formData: FormData): Promise<ActionResult> {
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

  const attachment = await prisma.expenseAttachment.create({
    data: {
      expenseId,
      fileName: file.name,
      storageKey: stored.key,
      fileType: file.type,
      fileSizeBytes: BigInt(file.size),
      uploadedById: session.sub,
    },
  });

  await audit({ companyId: session.companyId, userId: session.sub, action: "UPLOAD_ATTACHMENT", entityType: "Expense", entityId: expenseId, newValue: { fileName: file.name } });
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
