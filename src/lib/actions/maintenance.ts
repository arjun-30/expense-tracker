"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { maintenanceTotalCost } from "@/lib/services/calculations";
import { nextSequenceNumber, withSequenceRetry } from "@/lib/services/sequence";
import { checkSpareReplacementRules, checkLowStock } from "@/lib/services/spare-intelligence";
import type { ActionResult } from "@/lib/actions/expenses";

const MAINT_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.MAINTENANCE_MANAGER];
const PURCHASE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.PURCHASE_MANAGER];

const machineSchema = z.object({
  machineCode: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  purchasePrice: z.coerce.number().min(0).optional().nullable(),
});
export type MachineInput = z.infer<typeof machineSchema>;

export async function createMachineAction(input: MachineInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, MAINT_ROLES);
  const parsed = machineSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const machine = await prisma.machine.create({ data: parsed.data });
  await audit({ userId: session.sub, action: "CREATE", module: "machinery", recordId: machine.id, newValue: machine });
  revalidatePath("/machinery");
  return { success: true, id: machine.id };
}

const sparePartSchema = z.object({
  partNumber: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  unit: z.string().default("pcs"),
  purchasePrice: z.coerce.number().min(0),
  currentStock: z.coerce.number().min(0).default(0),
  minimumStock: z.coerce.number().min(0).default(0),
  maximumStock: z.coerce.number().min(0).optional().nullable(),
  storageLocation: z.string().optional().nullable(),
});
export type SparePartInput = z.infer<typeof sparePartSchema>;

export async function createSparePartAction(input: SparePartInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [...MAINT_ROLES, Role.PURCHASE_MANAGER]);
  const parsed = sparePartSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const spare = await prisma.sparePart.create({ data: parsed.data });
  await audit({ userId: session.sub, action: "CREATE", module: "spareParts", recordId: spare.id, newValue: spare });
  revalidatePath("/spare-parts");
  return { success: true, id: spare.id };
}

const maintenanceSchema = z.object({
  machineId: z.string().min(1),
  date: z.coerce.date(),
  maintenanceType: z.enum(["PREVENTIVE", "CORRECTIVE", "BREAKDOWN", "EMERGENCY", "SCHEDULED_SERVICE"]),
  problem: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  technician: z.string().optional().nullable(),
  labourCost: z.coerce.number().min(0).default(0),
  otherCost: z.coerce.number().min(0).default(0),
  downtimeMinutes: z.coerce.number().int().min(0).optional().nullable(),
  nextMaintenanceDate: z.coerce.date().optional().nullable(),
  remarks: z.string().optional().nullable(),
  spares: z.array(z.object({
    sparePartId: z.string().min(1),
    quantity: z.coerce.number().positive(),
  })).default([]),
});
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;

export async function createMaintenanceRecordAction(input: MaintenanceInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, MAINT_ROLES);
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const spareParts = data.spares.length
    ? await prisma.sparePart.findMany({ where: { id: { in: data.spares.map((s) => s.sparePartId) } } })
    : [];
  const spareMap = new Map(spareParts.map((s) => [s.id, s]));

  for (const item of data.spares) {
    const spare = spareMap.get(item.sparePartId);
    if (!spare) return { success: false, error: "Spare part not found" };
    if (Number(spare.currentStock) < item.quantity) {
      return { success: false, error: `Insufficient stock for ${spare.name} (available: ${spare.currentStock})` };
    }
  }

  const sparePartsCost = data.spares.reduce((sum, item) => {
    const spare = spareMap.get(item.sparePartId)!;
    return sum + item.quantity * Number(spare.purchasePrice);
  }, 0);
  const totalCost = maintenanceTotalCost(data.labourCost, sparePartsCost, data.otherCost);

  const record = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const ticketNumber = await nextSequenceNumber(tx.maintenanceRecord, "MNT");
      const created = await tx.maintenanceRecord.create({
        data: {
          ticketNumber,
          machineId: data.machineId,
          date: data.date,
          maintenanceType: data.maintenanceType,
          problem: data.problem || null,
          diagnosis: data.diagnosis || null,
          technician: data.technician || null,
          labourCost: data.labourCost,
          sparePartsCost,
          otherCost: data.otherCost,
          totalCost,
          downtimeMinutes: data.downtimeMinutes ?? null,
          nextMaintenanceDate: data.nextMaintenanceDate ?? null,
          remarks: data.remarks || null,
          createdById: session.sub,
        },
      });

      for (const item of data.spares) {
        const spare = spareMap.get(item.sparePartId)!;
        const unitCost = Number(spare.purchasePrice);
        await tx.maintenanceSpare.create({
          data: {
            maintenanceRecordId: created.id,
            sparePartId: item.sparePartId,
            quantity: item.quantity,
            unitCost,
            totalCost: item.quantity * unitCost,
            issuedById: session.sub,
          },
        });
        await tx.sparePart.update({
          where: { id: item.sparePartId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.inventoryTransaction.create({
          data: {
            sparePartId: item.sparePartId,
            type: "ISSUE",
            quantity: -item.quantity,
            machineId: data.machineId,
            unitCost,
            totalCost: item.quantity * unitCost,
            performedById: session.sub,
          },
        });
      }

      if (data.maintenanceType === "BREAKDOWN" || data.maintenanceType === "EMERGENCY") {
        await tx.machine.update({ where: { id: data.machineId }, data: { status: "UNDER_MAINTENANCE" } });
      }

      return created;
    })
  );

  await audit({ userId: session.sub, action: "CREATE", module: "maintenance", recordId: record.id, newValue: record });

  for (const item of data.spares) {
    await checkSpareReplacementRules({ sparePartId: item.sparePartId, machineId: data.machineId, issuedAt: data.date });
    await checkLowStock(item.sparePartId);
  }

  revalidatePath("/maintenance");
  revalidatePath("/spare-parts");
  revalidatePath("/machinery");
  return { success: true, id: record.id };
}

const adjustmentSchema = z.object({
  sparePartId: z.string().min(1),
  type: z.enum(["PURCHASE", "RETURN", "ADJUSTMENT", "DAMAGED", "SCRAP"]),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional().nullable(),
});
export type InventoryAdjustmentInput = z.infer<typeof adjustmentSchema>;

export async function adjustInventoryAction(input: InventoryAdjustmentInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [...PURCHASE_ROLES, ...MAINT_ROLES]);
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const spare = await prisma.sparePart.findUnique({ where: { id: data.sparePartId } });
  if (!spare) return { success: false, error: "Spare part not found" };

  const isDecrease = data.type === "DAMAGED" || data.type === "SCRAP";
  const delta = isDecrease ? -data.quantity : data.quantity;
  if (isDecrease && Number(spare.currentStock) < data.quantity) {
    return { success: false, error: `Cannot remove more than available stock (${spare.currentStock})` };
  }

  await prisma.$transaction([
    prisma.sparePart.update({ where: { id: data.sparePartId }, data: { currentStock: { increment: delta } } }),
    prisma.inventoryTransaction.create({
      data: {
        sparePartId: data.sparePartId,
        type: data.type,
        quantity: delta,
        notes: data.notes || null,
        performedById: session.sub,
      },
    }),
  ]);

  await audit({ userId: session.sub, action: `INVENTORY_${data.type}`, module: "spareParts", recordId: data.sparePartId, newValue: { quantity: delta } });
  await checkLowStock(data.sparePartId);
  revalidatePath("/spare-parts");
  return { success: true };
}
