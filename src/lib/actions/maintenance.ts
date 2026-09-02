"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { maintenanceTotalCost } from "@/lib/services/calculations";
import { nextSequenceNumber, withSequenceRetry } from "@/lib/services/sequence";
import { checkSpareReplacementRules, checkLowStock } from "@/lib/services/spare-intelligence";
import type { ActionResult } from "@/lib/actions/expenses";

const MAINT_PERMISSIONS = ["maintenance.manage"];
const MACHINERY_PERMISSIONS = ["machinery.manage"];
const CONSUMABLE_PERMISSIONS = ["consumables.manage"];

const machineSchema = z.object({
  machineCode: z.string().min(1),
  name: z.string().min(1),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  purchaseCost: z.coerce.number().min(0).optional().nullable(),
});
export type MachineInput = z.infer<typeof machineSchema>;

export async function createMachineAction(input: MachineInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, MACHINERY_PERMISSIONS);
  const parsed = machineSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const machine = await prisma.machine.create({ data: { ...parsed.data, companyId: session.companyId } });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Machine", entityId: machine.id, newValue: machine });
  revalidatePath("/machinery");
  return { success: true, id: machine.id };
}

const consumableSchema = z.object({
  partNumber: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  unit: z.string().default("pcs"),
  unitCost: z.coerce.number().min(0),
  currentStock: z.coerce.number().min(0).default(0),
  minimumStock: z.coerce.number().min(0).default(0),
  maximumStock: z.coerce.number().min(0).optional().nullable(),
  storageLocation: z.string().optional().nullable(),
});
export type ConsumableInput = z.infer<typeof consumableSchema>;

// Renamed from createSparePartAction — consumables have no default-supplier
// field any more, supplier is only ever recorded per purchase order.
export async function createConsumableAction(input: ConsumableInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, [...CONSUMABLE_PERMISSIONS, ...MAINT_PERMISSIONS]);
  const parsed = consumableSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const consumable = await prisma.consumable.create({ data: { ...parsed.data, companyId: session.companyId } });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Consumable", entityId: consumable.id, newValue: consumable });
  revalidatePath("/spare-parts");
  return { success: true, id: consumable.id };
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
  spares: z.array(z.object({
    consumableId: z.string().min(1),
    quantity: z.coerce.number().positive(),
  })).default([]),
});
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;

function priorityForType(type: MaintenanceInput["maintenanceType"]): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (type === "EMERGENCY") return "CRITICAL";
  if (type === "BREAKDOWN") return "HIGH";
  return "MEDIUM";
}

// The new schema splits "someone reported a problem" (maintenance_requests)
// from "the work that was actually done" (maintenance_records). This form is
// still a single step, so it creates a matching, already-resolved
// MaintenanceRequest alongside the MaintenanceRecord in the same transaction.
export async function createMaintenanceRecordAction(input: MaintenanceInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, MAINT_PERMISSIONS);
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const consumables = data.spares.length
    ? await prisma.consumable.findMany({ where: { id: { in: data.spares.map((s) => s.consumableId) } } })
    : [];
  const consumableMap = new Map(consumables.map((c) => [c.id, c]));

  for (const item of data.spares) {
    const consumable = consumableMap.get(item.consumableId);
    if (!consumable) return { success: false, error: "Spare part not found" };
    if (Number(consumable.currentStock) < item.quantity) {
      return { success: false, error: `Insufficient stock for ${consumable.name} (available: ${consumable.currentStock})` };
    }
  }

  const consumablesCost = data.spares.reduce((sum, item) => {
    const consumable = consumableMap.get(item.consumableId)!;
    return sum + item.quantity * Number(consumable.unitCost);
  }, 0);
  const totalCost = maintenanceTotalCost(data.labourCost, consumablesCost, data.otherCost);

  const record = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const request = await tx.maintenanceRequest.create({
        data: {
          machineId: data.machineId,
          requestedById: session.sub,
          problemDescription: data.problem || "Maintenance performed",
          priority: priorityForType(data.maintenanceType),
          status: "RESOLVED",
        },
      });

      const ticketNumber = await nextSequenceNumber(tx.maintenanceRecord, "MNT");
      const created = await tx.maintenanceRecord.create({
        data: {
          maintenanceRequestId: request.id,
          machineId: data.machineId,
          ticketNumber,
          maintenanceType: data.maintenanceType,
          diagnosis: data.diagnosis || null,
          technician: data.technician || null,
          labourCost: data.labourCost,
          consumablesCost,
          otherCost: data.otherCost,
          totalCost,
          downtimeMinutes: data.downtimeMinutes ?? null,
          startTime: data.date,
          createdById: session.sub,
        },
      });

      for (const item of data.spares) {
        const consumable = consumableMap.get(item.consumableId)!;
        const unitCost = Number(consumable.unitCost);
        await tx.maintenanceSpare.create({
          data: {
            maintenanceRecordId: created.id,
            consumableId: item.consumableId,
            quantity: item.quantity,
            unitCost,
            totalCost: item.quantity * unitCost,
            issuedById: session.sub,
          },
        });
        await tx.consumable.update({
          where: { id: item.consumableId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.consumableStockMovement.create({
          data: {
            consumableId: item.consumableId,
            movementType: "ISSUE",
            quantity: -item.quantity,
            referenceType: "maintenance_record",
            referenceId: created.id,
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

  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "MaintenanceRecord", entityId: record.id, newValue: record });

  for (const item of data.spares) {
    await checkSpareReplacementRules({ companyId: session.companyId, consumableId: item.consumableId, machineId: data.machineId, issuedAt: data.date });
    await checkLowStock(session.companyId, item.consumableId);
  }

  revalidatePath("/maintenance");
  revalidatePath("/spare-parts");
  revalidatePath("/machinery");
  return { success: true, id: record.id };
}

const adjustmentSchema = z.object({
  consumableId: z.string().min(1),
  type: z.enum(["PURCHASE", "RETURN", "ADJUSTMENT", "DAMAGED", "SCRAP"]),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional().nullable(),
});
export type InventoryAdjustmentInput = z.infer<typeof adjustmentSchema>;

export async function adjustInventoryAction(input: InventoryAdjustmentInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, [...CONSUMABLE_PERMISSIONS, ...MAINT_PERMISSIONS]);
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const consumable = await prisma.consumable.findUnique({ where: { id: data.consumableId } });
  if (!consumable) return { success: false, error: "Spare part not found" };

  const isDecrease = data.type === "DAMAGED" || data.type === "SCRAP";
  const delta = isDecrease ? -data.quantity : data.quantity;
  if (isDecrease && Number(consumable.currentStock) < data.quantity) {
    return { success: false, error: `Cannot remove more than available stock (${consumable.currentStock})` };
  }

  await prisma.$transaction([
    prisma.consumable.update({ where: { id: data.consumableId }, data: { currentStock: { increment: delta } } }),
    prisma.consumableStockMovement.create({
      data: {
        consumableId: data.consumableId,
        movementType: data.type,
        quantity: delta,
        notes: data.notes || null,
        performedById: session.sub,
      },
    }),
  ]);

  await audit({ companyId: session.companyId, userId: session.sub, action: `INVENTORY_${data.type}`, entityType: "Consumable", entityId: data.consumableId, newValue: { quantity: delta } });
  await checkLowStock(session.companyId, data.consumableId);
  revalidatePath("/spare-parts");
  return { success: true };
}
