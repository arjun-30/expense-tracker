"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { NotificationSeverity } from "@/generated/prisma/enums";
import { ROLES } from "@/lib/rbac-client";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { fuelEfficiencyKmpl } from "@/lib/services/calculations";
import { nextSequenceNumber, withSequenceRetry } from "@/lib/services/sequence";
import type { ActionResult } from "@/lib/actions/expenses";

const VEHICLE_PERMISSIONS = ["vehicles.manage"];
const FUEL_PERMISSIONS = ["fuel.manage"];
const TRANSPORT_PERMISSIONS = ["transportation.manage"];

const vehicleSchema = z.object({
  registrationNumber: z.string().min(1),
  vehicleType: z.string().min(1),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.coerce.number().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  currentOdometer: z.coerce.number().min(0).default(0),
  insuranceExpiry: z.coerce.date().optional().nullable(),
  pollutionExpiry: z.coerce.date().optional().nullable(),
  fitnessExpiry: z.coerce.date().optional().nullable(),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

// A vehicle's insurance/fitness/pollution expiry dates are no longer scalar
// columns on Vehicle — they're rows in `vehicle_documents` (one per document
// type), which also carries a `storage_key` for the scanned certificate.
// This form only collects the expiry date, not a file upload, so new
// documents are created with a placeholder storage key until a real upload
// flow is built for vehicle documents (out of scope for this cutover).
const PENDING_UPLOAD_KEY = "pending-upload";

export async function createVehicleAction(input: VehicleInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, VEHICLE_PERMISSIONS);
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { insuranceExpiry, pollutionExpiry, fitnessExpiry, ...data } = parsed.data;

  const vehicle = await prisma.$transaction(async (tx) => {
    const created = await tx.vehicle.create({ data: { ...data, companyId: session.companyId } });
    const documents: { documentType: "INSURANCE" | "POLLUTION" | "FITNESS"; validUntil: Date }[] = [];
    if (insuranceExpiry) documents.push({ documentType: "INSURANCE", validUntil: insuranceExpiry });
    if (pollutionExpiry) documents.push({ documentType: "POLLUTION", validUntil: pollutionExpiry });
    if (fitnessExpiry) documents.push({ documentType: "FITNESS", validUntil: fitnessExpiry });
    if (documents.length) {
      await tx.vehicleDocument.createMany({
        data: documents.map((d) => ({ vehicleId: created.id, documentType: d.documentType, validUntil: d.validUntil, storageKey: PENDING_UPLOAD_KEY })),
      });
    }
    return created;
  });

  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Vehicle", entityId: vehicle.id, newValue: vehicle });
  revalidatePath("/vehicles");
  return { success: true, id: vehicle.id };
}

const driverSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  licenseExpiry: z.coerce.date().optional().nullable(),
});
export type DriverInput = z.infer<typeof driverSchema>;

export async function createDriverAction(input: DriverInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, VEHICLE_PERMISSIONS);
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const driver = await prisma.driver.create({ data: { ...parsed.data, companyId: session.companyId } });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Driver", entityId: driver.id, newValue: driver });
  revalidatePath("/vehicles");
  return { success: true, id: driver.id };
}

const fuelSchema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().optional().nullable(),
  date: z.coerce.date(),
  fuelType: z.enum(["DIESEL", "PETROL", "CNG", "OTHER"]),
  fuelStation: z.string().optional().nullable(),
  litres: z.coerce.number().positive(),
  ratePerLitre: z.coerce.number().positive(),
  odometerReading: z.coerce.number().positive(),
});
export type FuelInput = z.infer<typeof fuelSchema>;

const ANOMALY_THRESHOLD = Number(process.env.FUEL_ANOMALY_THRESHOLD ?? "0.75");

export async function createFuelTransactionAction(input: FuelInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, FUEL_PERMISSIONS);
  const parsed = fuelSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle) return { success: false, error: "Vehicle not found" };
  const previousOdometer = Number(vehicle.currentOdometer);
  if (data.odometerReading <= previousOdometer) {
    return { success: false, error: `Odometer reading must be greater than the last recorded reading (${previousOdometer} km)` };
  }

  const distance = data.odometerReading - previousOdometer;
  const totalAmount = Math.round(data.litres * data.ratePerLitre * 100) / 100;
  const efficiency = fuelEfficiencyKmpl(distance, data.litres);

  const pastTxns = await prisma.fuelTransaction.findMany({
    where: { vehicleId: data.vehicleId },
    orderBy: { date: "desc" },
    take: 10,
    select: { efficiencyKmpl: true },
  });
  const pastEfficiencies = pastTxns.map((t) => Number(t.efficiencyKmpl)).filter((n) => n > 0);
  const historicalAvg = pastEfficiencies.length > 0 ? pastEfficiencies.reduce((a, b) => a + b, 0) / pastEfficiencies.length : null;
  const isAnomaly = historicalAvg !== null && efficiency !== null && efficiency < historicalAvg * ANOMALY_THRESHOLD;
  const anomalyNote = isAnomaly
    ? `Efficiency ${efficiency!.toFixed(2)} km/L is below ${(ANOMALY_THRESHOLD * 100).toFixed(0)}% of this vehicle's historical average (${historicalAvg!.toFixed(2)} km/L)`
    : null;

  const txn = await prisma.$transaction(async (tx) => {
    const created = await tx.fuelTransaction.create({
      data: {
        vehicleId: data.vehicleId,
        driverId: data.driverId || null,
        date: data.date,
        fuelType: data.fuelType,
        fuelStation: data.fuelStation || null,
        litres: data.litres,
        ratePerLitre: data.ratePerLitre,
        totalAmount,
        odometerReading: data.odometerReading,
        previousOdometerReading: previousOdometer,
        distanceTravelled: distance,
        efficiencyKmpl: efficiency,
        isAnomaly,
        anomalyNote,
      },
    });
    await tx.vehicle.update({ where: { id: data.vehicleId }, data: { currentOdometer: data.odometerReading } });
    return created;
  });

  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "FuelTransaction", entityId: txn.id, newValue: txn });

  if (isAnomaly) {
    await notify({
      companyId: session.companyId,
      roleName: ROLES.TRANSPORT_MANAGER,
      type: "fuel_efficiency_drop",
      severity: NotificationSeverity.WARNING,
      title: "Unusual fuel consumption detected",
      message: `${vehicle.registrationNumber}: ${anomalyNote}`,
      entityType: "FuelTransaction",
      entityId: txn.id,
    });
  }

  revalidatePath("/fuel");
  revalidatePath("/vehicles");
  return { success: true, id: txn.id };
}

const tripSchema = z.object({
  date: z.coerce.date(),
  vehicleId: z.string().min(1),
  transporterId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  source: z.string().min(1),
  destination: z.string().min(1),
  material: z.string().optional().nullable(),
  quantity: z.coerce.number().positive().optional().nullable(),
  unit: z.string().optional().nullable(),
  freight: z.coerce.number().min(0).default(0),
  loadingCost: z.coerce.number().min(0).default(0),
  unloadingCost: z.coerce.number().min(0).default(0),
  toll: z.coerce.number().min(0).default(0),
});
export type TripInput = z.infer<typeof tripSchema>;

export async function createTransportTripAction(input: TripInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, TRANSPORT_PERMISSIONS);
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const totalCost = Math.round((data.freight + data.loadingCost + data.unloadingCost + data.toll) * 100) / 100;

  const trip = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const tripNumber = await nextSequenceNumber(tx.transportTrip, "TRP");
      return tx.transportTrip.create({
        data: {
          companyId: session.companyId,
          tripNumber,
          date: data.date,
          vehicleId: data.vehicleId,
          transporterId: data.transporterId || null,
          driverId: data.driverId || null,
          source: data.source,
          destination: data.destination,
          material: data.material || null,
          quantity: data.quantity ?? null,
          unit: data.unit || null,
          freight: data.freight,
          loadingCost: data.loadingCost,
          unloadingCost: data.unloadingCost,
          toll: data.toll,
          totalCost,
        },
      });
    })
  );

  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "TransportTrip", entityId: trip.id, newValue: trip });
  revalidatePath("/transportation");
  return { success: true, id: trip.id };
}
