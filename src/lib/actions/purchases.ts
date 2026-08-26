"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { nextSequenceNumber, withSequenceRetry } from "@/lib/services/sequence";
import type { ActionResult } from "@/lib/actions/expenses";

const PURCHASE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.PURCHASE_MANAGER];
const PAYMENT_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ACCOUNTS];

const poItemSchema = z.object({
  sparePartId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  gstPercent: z.coerce.number().min(0).default(0),
});

const poSchema = z.object({
  vendorId: z.string().min(1),
  expectedDelivery: z.coerce.date().optional().nullable(),
  items: z.array(poItemSchema).min(1, "Add at least one item"),
});
export type PurchaseOrderInput = z.infer<typeof poSchema>;

export async function createPurchaseOrderAction(input: PurchaseOrderInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, PURCHASE_ROLES);
  const parsed = poSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const itemsWithTotals = data.items.map((it) => ({
    ...it,
    total: Math.round(it.quantity * it.unitPrice * (1 + it.gstPercent / 100) * 100) / 100,
  }));
  const totalAmount = itemsWithTotals.reduce((sum, it) => sum + it.total, 0);

  const po = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const poNumber = await nextSequenceNumber(tx.purchaseOrder, "PO");
      return tx.purchaseOrder.create({
        data: {
          poNumber,
          vendorId: data.vendorId,
          expectedDelivery: data.expectedDelivery ?? null,
          totalAmount,
          createdById: session.sub,
          status: "ORDERED",
          items: { create: itemsWithTotals.map(({ sparePartId, description, quantity, unitPrice, gstPercent, total }) => ({
            sparePartId: sparePartId || null,
            description,
            quantity,
            unitPrice,
            gstPercent,
            total,
          })) },
        },
      });
    })
  );

  await audit({ userId: session.sub, action: "CREATE", module: "purchases", recordId: po.id, newValue: po });
  revalidatePath("/purchases");
  return { success: true, id: po.id };
}

export async function receiveGoodsAction(purchaseOrderId: string): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, PURCHASE_ROLES);

  const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { items: true } });
  if (!po) return { success: false, error: "Purchase order not found" };
  if (po.status === "RECEIVED" || po.status === "CANCELLED") {
    return { success: false, error: `Purchase order already ${po.status.toLowerCase()}` };
  }

  await prisma.$transaction(async (tx) => {
    for (const item of po.items) {
      const remaining = Number(item.quantity) - Number(item.receivedQuantity);
      if (remaining <= 0) continue;
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQuantity: item.quantity },
      });
      if (item.sparePartId) {
        await tx.sparePart.update({
          where: { id: item.sparePartId },
          data: { currentStock: { increment: remaining } },
        });
        await tx.inventoryTransaction.create({
          data: {
            sparePartId: item.sparePartId,
            type: "PURCHASE",
            quantity: remaining,
            purchaseOrderId: po.id,
            unitCost: item.unitPrice,
            totalCost: remaining * Number(item.unitPrice),
            performedById: session.sub,
          },
        });
      }
    }
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "RECEIVED", actualDelivery: new Date() },
    });
  });

  await audit({ userId: session.sub, action: "RECEIVE_GOODS", module: "purchases", recordId: po.id });
  revalidatePath("/purchases");
  revalidatePath("/spare-parts");
  return { success: true, id: po.id };
}

const invoiceSchema = z.object({
  vendorId: z.string().min(1),
  purchaseOrderId: z.string().optional().nullable(),
  invoiceNumber: z.string().min(1),
  amount: z.coerce.number().positive(),
  taxAmount: z.coerce.number().min(0).default(0),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export async function createInvoiceAction(input: InvoiceInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [...PURCHASE_ROLES, Role.ACCOUNTS]);
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const existing = await prisma.invoice.findUnique({
    where: { vendorId_invoiceNumber: { vendorId: data.vendorId, invoiceNumber: data.invoiceNumber } },
  });
  if (existing) return { success: false, error: "This invoice number already exists for this vendor" };

  const invoice = await prisma.invoice.create({
    data: {
      vendorId: data.vendorId,
      purchaseOrderId: data.purchaseOrderId || null,
      invoiceNumber: data.invoiceNumber,
      amount: data.amount,
      taxAmount: data.taxAmount,
      totalAmount: data.amount + data.taxAmount,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate ?? null,
    },
  });

  await audit({ userId: session.sub, action: "CREATE", module: "invoices", recordId: invoice.id, newValue: invoice });
  revalidatePath("/purchases");
  revalidatePath("/payments");
  return { success: true, id: invoice.id };
}

const paymentSchema = z.object({
  vendorId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  amount: z.coerce.number().positive(),
  paymentDate: z.coerce.date(),
  method: z.enum(["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE", "CREDIT"]),
  referenceNumber: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export async function createPaymentAction(input: PaymentInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, PAYMENT_ROLES);
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  let invoice = null;
  if (data.invoiceId) {
    invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId }, include: { payments: true } });
    if (!invoice) return { success: false, error: "Invoice not found" };
    const alreadyPaid = invoice.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    if (alreadyPaid + data.amount > Number(invoice.totalAmount) + 0.01) {
      return { success: false, error: "Payment amount exceeds the outstanding invoice balance" };
    }
  }

  const payment = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const paymentNumber = await nextSequenceNumber(tx.payment, "PAY");
      return tx.payment.create({
        data: {
          paymentNumber,
          vendorId: data.vendorId,
          invoiceId: data.invoiceId || null,
          amount: data.amount,
          paymentDate: data.paymentDate,
          method: data.method,
          referenceNumber: data.referenceNumber || null,
          bank: data.bank || null,
          remarks: data.remarks || null,
          status: "PAID",
          createdById: session.sub,
        },
      });
    })
  );

  if (invoice) {
    const totalPaid = invoice.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0) + data.amount;
    const newStatus = totalPaid >= Number(invoice.totalAmount) - 0.01 ? "PAID" : "PARTIALLY_PAID";
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: newStatus } });
  }

  await audit({ userId: session.sub, action: "CREATE", module: "payments", recordId: payment.id, newValue: payment });
  await notify({
    role: Role.ADMIN,
    type: "pending_payment",
    title: "Payment recorded",
    message: `Payment ${payment.paymentNumber} of ₹${data.amount.toLocaleString("en-IN")} recorded.`,
    entityType: "Payment",
    entityId: payment.id,
  });

  revalidatePath("/payments");
  revalidatePath("/purchases");
  return { success: true, id: payment.id };
}
