"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/expenses";

const VENDOR_PERMISSIONS = ["vendors.manage"];

const vendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type VendorInput = z.infer<typeof vendorSchema>;

function toVendorData(data: z.infer<typeof vendorSchema>) {
  const { status, ...rest } = data;
  return { ...rest, isActive: status === "ACTIVE" };
}

export async function createVendorAction(input: VendorInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, VENDOR_PERMISSIONS);
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const vendor = await prisma.vendor.create({ data: { ...toVendorData(parsed.data), companyId: session.companyId } });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Vendor", entityId: vendor.id, newValue: vendor });
  revalidatePath("/vendors");
  return { success: true, id: vendor.id };
}

export async function updateVendorAction(id: string, input: VendorInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, VENDOR_PERMISSIONS);
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Vendor not found" };

  const vendor = await prisma.vendor.update({ where: { id }, data: toVendorData(parsed.data) });
  await audit({ companyId: session.companyId, userId: session.sub, action: "UPDATE", entityType: "Vendor", entityId: id, oldValue: existing, newValue: vendor });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { success: true, id };
}
