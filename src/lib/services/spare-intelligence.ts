import "server-only";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { NotificationSeverity } from "@/generated/prisma/enums";
import { ROLES } from "@/lib/rbac-client";
import { spareReplacementFrequency } from "@/lib/services/calculations";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Runs the four repeated-spare-replacement rules (§19) after a consumable is
 * issued against a maintenance record on a machine. Fires an in-app
 * notification per rule that trips — callers don't need to know the rule
 * details.
 */
export async function checkSpareReplacementRules(params: {
  companyId: string;
  consumableId: string;
  machineId: string;
  issuedAt: Date;
}) {
  const [consumable, machine] = await Promise.all([
    prisma.consumable.findUnique({ where: { id: params.consumableId } }),
    prisma.machine.findUnique({ where: { id: params.machineId } }),
  ]);
  if (!consumable || !machine) return;

  const sameSpareOnMachine = await prisma.maintenanceSpare.findMany({
    where: {
      consumableId: params.consumableId,
      maintenanceRecord: { machineId: params.machineId },
    },
    include: { maintenanceRecord: true },
    orderBy: { issuedAt: "desc" },
  });

  const within = (days: number) =>
    sameSpareOnMachine.filter((s) => params.issuedAt.getTime() - s.issuedAt.getTime() <= days * DAY_MS && s.issuedAt.getTime() <= params.issuedAt.getTime());

  const within7 = within(7);
  const within30 = within(30);

  // Rule 1 — same spare, same machine, replaced again within 7 days.
  if (within7.length >= 2) {
    const previous = within7[1];
    const daysAgo = Math.round((params.issuedAt.getTime() - previous.issuedAt.getTime()) / DAY_MS);
    await notify({
      companyId: params.companyId,
      roleName: ROLES.MAINTENANCE_MANAGER,
      type: "same_spare_same_machine",
      severity: NotificationSeverity.CRITICAL,
      title: "Repeated Spare Replacement",
      message: `${consumable.name} was replaced ${daysAgo} day(s) ago on ${machine.name} and has been replaced again. Possible causes: poor-quality spare, incorrect installation, machine problem, excessive load, or incorrect specification.`,
      entityType: "Machine",
      entityId: machine.id,
    });
  }

  // Rule 2 — same spare replaced 3+ times within 30 days.
  if (within30.length >= 3) {
    await notify({
      companyId: params.companyId,
      roleName: ROLES.MAINTENANCE_MANAGER,
      type: "critical_repeated_failure",
      severity: NotificationSeverity.CRITICAL,
      title: "Critical repeated failure",
      message: `${consumable.name} has been replaced ${within30.length} times on ${machine.name} in the last 30 days.`,
      entityType: "Machine",
      entityId: machine.id,
    });
  }

  // Rule 3 — replacement frequency exceeds this spare's historical average across all machines.
  const allReplacements = await prisma.maintenanceSpare.findMany({
    where: { consumableId: params.consumableId },
    orderBy: { issuedAt: "asc" },
    select: { issuedAt: true },
  });
  if (allReplacements.length >= 4) {
    const first = allReplacements[0].issuedAt;
    const totalDays = Math.max(1, (params.issuedAt.getTime() - first.getTime()) / DAY_MS);
    const overallFrequency = spareReplacementFrequency(allReplacements.length, totalDays);
    const recentFrequency = spareReplacementFrequency(within30.length, 30);
    if (recentFrequency > overallFrequency * 1.5) {
      await notify({
        companyId: params.companyId,
        roleName: ROLES.MAINTENANCE_MANAGER,
        type: "abnormal_spare_consumption",
        severity: NotificationSeverity.WARNING,
        title: "Abnormal spare consumption",
        message: `${consumable.name} is being replaced faster than its historical average (${recentFrequency.toFixed(1)} vs ${overallFrequency.toFixed(1)} per 30 days).`,
        entityType: "Consumable",
        entityId: consumable.id,
      });
    }
  }

  // Rule 4 — this supplier's spares failing repeatedly across the fleet.
  // Consumables have no stored default supplier any more (supplier is only
  // ever recorded per purchase order), so the "current supplier" is derived
  // from the most recent purchase order line for this consumable.
  const recentPoItem = await prisma.purchaseOrderItem.findFirst({
    where: { consumableId: params.consumableId },
    orderBy: { purchaseOrder: { createdAt: "desc" } },
    include: { purchaseOrder: true },
  });
  const vendorId = recentPoItem?.purchaseOrder.vendorId;
  if (vendorId) {
    const since = new Date(params.issuedAt.getTime() - 60 * DAY_MS);
    const suppliedConsumables = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { vendorId }, consumableId: { not: null } },
      distinct: ["consumableId"],
      select: { consumableId: true },
    });
    const consumableIds = suppliedConsumables.map((r) => r.consumableId).filter((id): id is string => !!id);
    const supplierFailures = consumableIds.length
      ? await prisma.maintenanceSpare.count({
          where: { issuedAt: { gte: since, lte: params.issuedAt }, consumableId: { in: consumableIds } },
        })
      : 0;
    if (supplierFailures >= 3) {
      const supplier = await prisma.vendor.findUnique({ where: { id: vendorId } });
      await notify({
        companyId: params.companyId,
        roleName: ROLES.PURCHASE_MANAGER,
        type: "supplier_quality_issue",
        severity: NotificationSeverity.WARNING,
        title: "Supplier quality issue detected",
        message: `${supplier?.name ?? "Supplier"} has supplied parts involved in ${supplierFailures} replacements in the last 60 days.`,
        entityType: "Vendor",
        entityId: vendorId,
      });
    }
  }
}

export async function checkLowStock(companyId: string, consumableId: string) {
  const consumable = await prisma.consumable.findUnique({ where: { id: consumableId } });
  if (!consumable) return;
  if (Number(consumable.currentStock) < Number(consumable.minimumStock)) {
    await notify({
      companyId,
      roleName: ROLES.PURCHASE_MANAGER,
      type: "low_stock",
      severity: NotificationSeverity.WARNING,
      title: "Low Stock",
      message: `${consumable.name} — current stock ${consumable.currentStock}, minimum ${consumable.minimumStock}.`,
      entityType: "Consumable",
      entityId: consumable.id,
    });
  }
}

export interface SpareReliability {
  consumableId: string;
  name: string;
  replacements: number;
  averageLifespanDays: number | null;
  totalCost: number;
  costPerMonth: number;
  reliability: "Good" | "Fair" | "Poor";
}

export async function getSpareReliability(companyId: string): Promise<SpareReliability[]> {
  const consumables = await prisma.consumable.findMany({
    where: { companyId },
    include: { maintenanceSpares: { orderBy: { issuedAt: "asc" } } },
  });

  return consumables
    .filter((s) => s.maintenanceSpares.length > 0)
    .map((s) => {
      const events = s.maintenanceSpares;
      const totalCost = events.reduce((sum, e) => sum + Number(e.totalCost), 0);
      let averageLifespanDays: number | null = null;
      if (events.length > 1) {
        const gaps: number[] = [];
        for (let i = 1; i < events.length; i++) {
          gaps.push((events[i].issuedAt.getTime() - events[i - 1].issuedAt.getTime()) / DAY_MS);
        }
        averageLifespanDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      }
      const spanDays = Math.max(1, (events[events.length - 1].issuedAt.getTime() - events[0].issuedAt.getTime()) / DAY_MS);
      const costPerMonth = (totalCost / spanDays) * 30;

      let reliability: SpareReliability["reliability"] = "Good";
      if (averageLifespanDays !== null && averageLifespanDays < 14) reliability = "Poor";
      else if (averageLifespanDays !== null && averageLifespanDays < 45) reliability = "Fair";

      return {
        consumableId: s.id,
        name: s.name,
        replacements: events.length,
        averageLifespanDays,
        totalCost,
        costPerMonth,
        reliability,
      };
    })
    .sort((a, b) => b.replacements - a.replacements);
}
