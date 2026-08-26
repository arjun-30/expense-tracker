"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { Role, AlertSeverity } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { fuelEfficiencyKmpl, fuelCostPerKm, transportCostPerKg } from "@/lib/services/calculations";
import { nextSequenceNumber, withSequenceRetry } from "@/lib/services/sequence";
import type { ActionResult } from "@/lib/actions/expenses";

const FLEET_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.TRANSPORT_MANAGER];

const vehicleSchema = z.object({
  registrationNumber: z.string().min(1),
  vehicleType: z.string().min(1),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.coerce.number().optional().nullable(),
  driverId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  currentOdometer: z.coerce.number().min(0).default(0),
  insuranceExpiry: z.coerce.date().optional().nullable(),
  pollutionExpiry: z.coerce.date().optional().nullable(),
  fitnessExpiry: z.coerce.date().optional().nullable(),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export async function createVehicleAction(input: VehicleInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, FLEET_ROLES);
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const vehicle = await prisma.vehicle.create({ data: parsed.data });
  await audit({ userId: session.sub, action: "CREATE", module: "vehicles", recordId: vehicle.id, newValue: vehicle });
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
  requireRole(session, FLEET_ROLES);
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const driver = await prisma.driver.create({ data: parsed.data });
  await audit({ userId: session.sub, action: "CREATE", module: "vehicles", recordId: driver.id, newValue: driver });
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
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE", "CREDIT"]).optional().nullable(),
  remarks: z.string().optional().nullable(),
});
export type FuelInput = z.infer<typeof fuelSchema>;

const ANOMALY_THRESHOLD = Number(process.env.FUEL_ANOMALY_THRESHOLD ?? "0.75");

export async function createFuelTransactionAction(input: FuelInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [...FLEET_ROLES, Role.ACCOUNTS]);
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
  const costPerKm = fuelCostPerKm(totalAmount, distance);

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
        costPerKm,
        isAnomaly,
        anomalyNote,
        paymentMethod: data.paymentMethod || null,
        remarks: data.remarks || null,
      },
    });
    await tx.vehicle.update({ where: { id: data.vehicleId }, data: { currentOdometer: data.odometerReading } });
    return created;
  });

  await audit({ userId: session.sub, action: "CREATE", module: "fuel", recordId: txn.id, newValue: txn });

  if (isAnomaly) {
    await notify({
      role: Role.TRANSPORT_MANAGER,
      type: "fuel_efficiency_drop",
      severity: AlertSeverity.WARNING,
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
  numberOfTrips: z.coerce.number().int().positive().default(1),
  freight: z.coerce.number().min(0).default(0),
  loadingCost: z.coerce.number().min(0).default(0),
  unloadingCost: z.coerce.number().min(0).default(0),
  toll: z.coerce.number().min(0).default(0),
  parking: z.coerce.number().min(0).default(0),
  otherCharges: z.coerce.number().min(0).default(0),
});
export type TripInput = z.infer<typeof tripSchema>;

export async function createTransportTripAction(input: TripInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [...FLEET_ROLES, Role.ACCOUNTS]);
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const totalCost = Math.round((data.freight + data.loadingCost + data.unloadingCost + data.toll + data.parking + data.otherCharges) * 100) / 100;
  const costPerKg = data.quantity ? transportCostPerKg(totalCost, data.quantity) : null;

  const trip = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const tripNumber = await nextSequenceNumber(tx.transportTrip, "TRP");
      return tx.transportTrip.create({
        data: {
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
          numberOfTrips: data.numberOfTrips,
          freight: data.freight,
          loadingCost: data.loadingCost,
          unloadingCost: data.unloadingCost,
          toll: data.toll,
          parking: data.parking,
          otherCharges: data.otherCharges,
          totalCost,
          costPerKg,
        },
      });
    })
  );

  await audit({ userId: session.sub, action: "CREATE", module: "transportation", recordId: trip.id, newValue: trip });
  revalidatePath("/transportation");
  return { success: true, id: trip.id };
}

