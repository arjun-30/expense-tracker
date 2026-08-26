import "server-only";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { Role, AlertSeverity } from "@/generated/prisma/enums";
import { spareReplacementFrequency } from "@/lib/services/calculations";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Runs the four repeated-spare-replacement rules (§19) after a spare is issued
 * against a maintenance record on a machine. Fires an in-app notification per
 * rule that trips — callers don't need to know the rule details.
 */
export async function checkSpareReplacementRules(params: {
  sparePartId: string;
  machineId: string;
  issuedAt: Date;
}) {
  const [sparePart, machine] = await Promise.all([
    prisma.sparePart.findUnique({ where: { id: params.sparePartId } }),
    prisma.machine.findUnique({ where: { id: params.machineId } }),
  ]);
  if (!sparePart || !machine) return;

  const sameSpareOnMachine = await prisma.maintenanceSpare.findMany({
    where: {
      sparePartId: params.sparePartId,
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
      role: Role.MAINTENANCE_MANAGER,
      type: "same_spare_same_machine",
      severity: AlertSeverity.CRITICAL,
      title: "Repeated Spare Replacement",
      message: `${sparePart.name} was replaced ${daysAgo} day(s) ago on ${machine.name} and has been replaced again. Possible causes: poor-quality spare, incorrect installation, machine problem, excessive load, or incorrect specification.`,
      entityType: "Machine",
      entityId: machine.id,
    });
  }

  // Rule 2 — same spare replaced 3+ times within 30 days.
  if (within30.length >= 3) {
    await notify({
      role: Role.MAINTENANCE_MANAGER,
      type: "critical_repeated_failure",
      severity: AlertSeverity.CRITICAL,
      title: "Critical repeated failure",
      message: `${sparePart.name} has been replaced ${within30.length} times on ${machine.name} in the last 30 days.`,
      entityType: "Machine",
      entityId: machine.id,
    });
  }

  // Rule 3 — replacement frequency exceeds this spare's historical average across all machines.
  const allReplacements = await prisma.maintenanceSpare.findMany({
    where: { sparePartId: params.sparePartId },
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
        role: Role.MAINTENANCE_MANAGER,
        type: "abnormal_spare_consumption",
        severity: AlertSeverity.WARNING,
        title: "Abnormal spare consumption",
        message: `${sparePart.name} is being replaced faster than its historical average (${recentFrequency.toFixed(1)} vs ${overallFrequency.toFixed(1)} per 30 days).`,
        entityType: "SparePart",
        entityId: sparePart.id,
      });
    }
  }

  // Rule 4 — this supplier's spares failing repeatedly across the fleet.
  if (sparePart.supplierId) {
    const since = new Date(params.issuedAt.getTime() - 60 * DAY_MS);
    const supplierFailures = await prisma.maintenanceSpare.count({
      where: {
        issuedAt: { gte: since, lte: params.issuedAt },
        sparePart: { supplierId: sparePart.supplierId },
      },
    });
    if (supplierFailures >= 3) {
      const supplier = await prisma.vendor.findUnique({ where: { id: sparePart.supplierId } });
      await notify({
        role: Role.PURCHASE_MANAGER,
        type: "supplier_quality_issue",
        severity: AlertSeverity.WARNING,
        title: "Supplier quality issue detected",
        message: `${supplier?.name ?? "Supplier"} has supplied parts involved in ${supplierFailures} replacements in the last 60 days.`,
        entityType: "Vendor",
        entityId: sparePart.supplierId,
      });
    }
  }
}

export async function checkLowStock(sparePartId: string) {
  const spare = await prisma.sparePart.findUnique({ where: { id: sparePartId } });
  if (!spare) return;
  if (Number(spare.currentStock) < Number(spare.minimumStock)) {
    await notify({
      role: Role.PURCHASE_MANAGER,
      type: "low_stock",
      severity: AlertSeverity.WARNING,
      title: "Low Stock",
      message: `${spare.name} — current stock ${spare.currentStock}, minimum ${spare.minimumStock}.`,
      entityType: "SparePart",
      entityId: spare.id,
    });
  }
}

export interface SpareReliability {
  sparePartId: string;
  name: string;
  replacements: number;
  averageLifespanDays: number | null;
  totalCost: number;
  costPerMonth: number;
  reliability: "Good" | "Fair" | "Poor";
}

export async function getSpareReliability(): Promise<SpareReliability[]> {
  const spares = await prisma.sparePart.findMany({
    include: { maintenanceSpares: { orderBy: { issuedAt: "asc" } } },
  });

  return spares
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
        sparePartId: s.id,
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
