"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/expenses";
import { vendorSchema, toVendorData, type VendorInput } from "@/lib/vendor-schema";

const VENDOR_PERMISSIONS = ["vendors.manage"];

export type { VendorInput };

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

  const existing = await prisma.vendor.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) return { success: false, error: "Vendor not found" };

  const vendor = await prisma.vendor.update({ where: { id }, data: toVendorData(parsed.data) });
  await audit({ companyId: session.companyId, userId: session.sub, action: "UPDATE", entityType: "Vendor", entityId: id, oldValue: existing, newValue: vendor });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { success: true, id };
}
