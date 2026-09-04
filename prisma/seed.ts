import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ROLES } from "../src/lib/rbac-client";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../src/lib/auth/permission-catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Not imported from src/lib/storage.ts — that module is "server-only", which
// this plain tsx script (run outside the Next.js server module graph) can't
// resolve. A minimal, standalone Cloudinary call is duplicated here instead.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

/** A real, openable one-page PDF for demo expense attachments — built with
 * pdf-lib (already a dependency, used the same way in src/lib/services/export.ts)
 * rather than a hand-rolled byte template, so it's guaranteed spec-valid. */
async function buildPlaceholderReceiptPdf(expenseNumber: string, totalAmount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([320, 240]);
  page.drawText("Sample Receipt", { x: 32, y: 190, size: 18, font });
  page.drawText(`Expense: ${expenseNumber}`, { x: 32, y: 150, size: 12, font });
  page.drawText(`Amount: Rs. ${totalAmount.toFixed(2)}`, { x: 32, y: 130, size: 12, font });
  page.drawText("This is placeholder demo data, not a real invoice.", { x: 32, y: 90, size: 9, font });
  return Buffer.from(await doc.save());
}

async function uploadSeedAttachment(buffer: Buffer, publicId: string): Promise<string | null> {
  try {
    const result = await new Promise<{ public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: "raw", overwrite: true },
        (error, uploadResult) => (error || !uploadResult ? reject(error ?? new Error("upload failed")) : resolve(uploadResult))
      );
      stream.end(buffer);
    });
    return result.public_id;
  } catch (err) {
    // Cloudinary isn't configured (or is unreachable) — skip this attachment
    // rather than seed a database row pointing at a file that doesn't exist.
    console.warn(`  (skipping seed attachment ${publicId}: ${err instanceof Error ? err.message : err})`);
    return null;
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function randomBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Seeding…");

  // ── Company (single-tenant for now) ─────────────────────────
  // Placeholder name — no real company name was found anywhere in the
  // existing seed data or UI copy (the app itself is just branded "MECS —
  // Manufacturing Expense & Cost Management System"). Rename this once the
  // real company name is confirmed (OPEN_DECISIONS.md #1).
  const company = await prisma.company.upsert({
    where: { id: "seed-company-1" },
    update: {},
    create: {
      id: "seed-company-1",
      name: "Plastic Manufacturing Co", // TODO: placeholder — rename to the real company name
      legalName: "Plastic Manufacturing Co Pvt Ltd",
      address: "Chennai, Tamil Nadu, India",
    },
  });
  const companyId = company.id;

  // ── Departments ──────────────────────────────────────────────
  const deptNames: [string, string][] = [
    ["Production", "DEPT-PROD"],
    ["Printing", "DEPT-PRINT"],
    ["Maintenance", "DEPT-MAINT"],
    ["Transportation", "DEPT-TRANS"],
    ["Warehouse", "DEPT-WARE"],
    ["Administration", "DEPT-ADMIN"],
    ["Sales", "DEPT-SALES"],
  ];
  const departments: Record<string, Awaited<ReturnType<typeof prisma.department.create>>> = {};
  for (const [name, code] of deptNames) {
    departments[name] = await prisma.department.upsert({
      where: { companyId_code: { companyId, code } },
      update: {},
      create: { companyId, name, code },
    });
  }

  // ── Cost centers ─────────────────────────────────────────────
  const ccDefs: [string, string, string][] = [
    ["Extrusion Line", "CC-PROD-01", "Production"],
    ["Printing Line", "CC-PRINT-01", "Printing"],
    ["Maintenance Shop", "CC-MAINT-01", "Maintenance"],
    ["Fleet Ops", "CC-TRANS-01", "Transportation"],
    ["Head Office", "CC-ADMIN-01", "Administration"],
  ];
  const costCenters: Record<string, Awaited<ReturnType<typeof prisma.costCenter.create>>> = {};
  for (const [name, code, dept] of ccDefs) {
    costCenters[code] = await prisma.costCenter.upsert({
      where: { companyId_code: { companyId, code } },
      update: {},
      create: { companyId, name, code, departmentId: departments[dept].id },
    });
  }

  // ── Permissions + roles + role_permissions ──────────────────
  const permissionsByCode: Record<string, Awaited<ReturnType<typeof prisma.permission.create>>> = {};
  for (const p of PERMISSIONS) {
    permissionsByCode[p.code] = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, module: p.module, description: p.description },
    });
  }

  const roleDefs = Object.values(ROLES);
  const roles: Record<string, Awaited<ReturnType<typeof prisma.role.create>>> = {};
  for (const roleName of roleDefs) {
    const role = await prisma.role.upsert({
      where: { companyId_name: { companyId, name: roleName } },
      update: {},
      create: { companyId, name: roleName, isSystemRole: true, description: `${roleName} — starter role seeded for the ERP cutover` },
    });
    roles[roleName] = role;

    for (const code of ROLE_PERMISSIONS[roleName] ?? []) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissionsByCode[code].id } },
        update: {},
        create: { roleId: role.id, permissionId: permissionsByCode[code].id },
      });
    }
  }

  // ── Users (one per role) ─────────────────────────────────────
  const password = await hash("Passw0rd!");
  const userDefs: { name: string; email: string; role: string; dept?: string }[] = [
    { name: "Ashwin Rao", email: "superadmin@mecs.local", role: ROLES.SUPER_ADMIN },
    { name: "Meera Krishnan", email: "admin@mecs.local", role: ROLES.ADMIN },
    { name: "Divya Suresh", email: "accounts@mecs.local", role: ROLES.ACCOUNTS, dept: "Administration" },
    { name: "Karthik Iyer", email: "purchase@mecs.local", role: ROLES.PURCHASE_MANAGER, dept: "Warehouse" },
    { name: "Ramesh Babu", email: "maintenance@mecs.local", role: ROLES.MAINTENANCE_MANAGER, dept: "Maintenance" },
    { name: "Suresh Kumar", email: "transport@mecs.local", role: ROLES.TRANSPORT_MANAGER, dept: "Transportation" },
    { name: "Priya Natarajan", email: "employee@mecs.local", role: ROLES.EMPLOYEE, dept: "Production" },
  ];
  const users: Record<string, Awaited<ReturnType<typeof prisma.user.create>>> = {};
  for (const u of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        companyId,
        name: u.name,
        email: u.email,
        passwordHash: password,
        departmentId: u.dept ? departments[u.dept].id : null,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[u.role].id } },
      update: {},
      create: { userId: user.id, roleId: roles[u.role].id },
    });
    users[u.role] = user;
  }

  // ── Expense categories / subcategories (max 2 levels) ────────
  const categoryTree: Record<string, string[]> = {
    Fuel: ["Diesel", "Petrol", "CNG", "Other"],
    Transportation: ["Freight", "Loading", "Unloading", "Toll", "Delivery", "Vehicle hire"],
    Machinery: ["Maintenance", "Repair", "Service", "AMC", "Machine parts"],
    "Spare Parts": ["Bearings", "Belts", "Motors", "Heaters", "Blades", "Electrical components", "Mechanical components", "Other"],
    Printing: ["Ink", "Solvents", "Plates", "Cylinders", "Chemicals", "Printing maintenance"],
    Office: ["Rent", "Electricity", "Internet", "Telephone", "Stationery", "Software", "Courier", "Office maintenance"],
    Production: ["Consumables", "Labour", "Utilities", "Packaging", "Outsourcing"],
  };
  const categories: Record<string, Awaited<ReturnType<typeof prisma.expenseCategory.create>>> = {};
  const subcategories: Awaited<ReturnType<typeof prisma.expenseSubcategory.create>>[] = [];
  for (const [parentName, children] of Object.entries(categoryTree)) {
    const code = parentName.toUpperCase().replace(/\s+/g, "_");
    const parent = await prisma.expenseCategory.upsert({
      where: { companyId_code: { companyId, code } },
      update: {},
      create: { companyId, name: parentName, code },
    });
    categories[parentName] = parent;
    for (const child of children) {
      const childCode = child.toUpperCase().replace(/\s+/g, "_");
      const sub = await prisma.expenseSubcategory.upsert({
        where: { categoryId_code: { categoryId: parent.id, code: childCode } },
        update: {},
        create: { name: child, code: childCode, categoryId: parent.id },
      });
      subcategories.push(sub);
    }
  }

  // ── Vendors ──────────────────────────────────────────────────
  const vendorDefs = [
    { name: "Tamilnadu Polymers Pvt Ltd", category: "Raw Material", gstNumber: "33AAAAA0000A1Z5" },
    { name: "SKF Bearing Distributors", category: "Spares", gstNumber: "33BBBBB1111B2Z6" },
    { name: "Anna Fuel Station", category: "Fuel", gstNumber: "33DDDDD3333D4Z8" },
    { name: "Precision Printing Supplies", category: "Printing", gstNumber: "33EEEEE4444E5Z9" },
  ];
  const vendors: Record<string, Awaited<ReturnType<typeof prisma.vendor.create>>> = {};
  for (const v of vendorDefs) {
    const existing = await prisma.vendor.findFirst({ where: { companyId, name: v.name } });
    vendors[v.name] = existing ?? (await prisma.vendor.create({ data: { ...v, companyId } }));
  }

  // ── Transporters (kept fully separate from vendors) ──────────
  const transporterDefs = [
    { name: "Chennai Freight Carriers", phone: "9840099001" },
    { name: "Tamilnadu Roadlines", phone: "9840099002" },
  ];
  const transporters: Record<string, Awaited<ReturnType<typeof prisma.transporter.create>>> = {};
  for (const t of transporterDefs) {
    const existing = await prisma.transporter.findFirst({ where: { companyId, name: t.name } });
    transporters[t.name] = existing ?? (await prisma.transporter.create({ data: { ...t, companyId } }));
  }

  // ── Drivers & Vehicles ───────────────────────────────────────
  const driver1 = await prisma.driver.upsert({
    where: { id: "seed-driver-1" },
    update: {},
    create: { id: "seed-driver-1", companyId, name: "Murugan S", phone: "9840011122", licenseNumber: "TN0120210001234" },
  });
  const driver2 = await prisma.driver.upsert({
    where: { id: "seed-driver-2" },
    update: {},
    create: { id: "seed-driver-2", companyId, name: "Selvam K", phone: "9840033344", licenseNumber: "TN0120200005678" },
  });

  const vehicle1 = await prisma.vehicle.upsert({
    where: { registrationNumber: "TN-01-AB-1234" },
    update: {},
    create: {
      companyId,
      registrationNumber: "TN-01-AB-1234",
      vehicleType: "Truck",
      manufacturer: "Tata",
      model: "407",
      year: 2021,
      departmentId: departments["Transportation"].id,
      currentOdometer: 45000,
    },
  });
  const vehicle2 = await prisma.vehicle.upsert({
    where: { registrationNumber: "TN-01-CD-5678" },
    update: {},
    create: {
      companyId,
      registrationNumber: "TN-01-CD-5678",
      vehicleType: "Van",
      manufacturer: "Mahindra",
      model: "Bolero Pickup",
      year: 2022,
      departmentId: departments["Transportation"].id,
      currentOdometer: 28000,
    },
  });

  const vehicleDocCount = await prisma.vehicleDocument.count();
  if (vehicleDocCount === 0) {
    await prisma.vehicleDocument.createMany({
      data: [
        { vehicleId: vehicle1.id, documentType: "INSURANCE", storageKey: "seed-doc-insurance-1.pdf", validUntil: daysAgo(-120) },
        { vehicleId: vehicle1.id, documentType: "POLLUTION", storageKey: "seed-doc-pollution-1.pdf", validUntil: daysAgo(-20) },
        { vehicleId: vehicle1.id, documentType: "FITNESS", storageKey: "seed-doc-fitness-1.pdf", validUntil: daysAgo(-200) },
        { vehicleId: vehicle2.id, documentType: "INSURANCE", storageKey: "seed-doc-insurance-2.pdf", validUntil: daysAgo(-300) },
        // already expired -> demo document-expiry alert
        { vehicleId: vehicle2.id, documentType: "POLLUTION", storageKey: "seed-doc-pollution-2.pdf", validUntil: daysAgo(15) },
        { vehicleId: vehicle2.id, documentType: "FITNESS", storageKey: "seed-doc-fitness-2.pdf", validUntil: daysAgo(-150) },
      ],
    });
  }

  // ── Machines ─────────────────────────────────────────────────
  const machineDefs = [
    { code: "EXT-01", name: "Extruder-01" },
    { code: "EXT-02", name: "Extruder-02" },
    { code: "PRINT-01", name: "Printing-Machine-01" },
    { code: "CUT-01", name: "Cutting-Machine-01" },
  ];
  const machines: Record<string, Awaited<ReturnType<typeof prisma.machine.create>>> = {};
  for (const m of machineDefs) {
    machines[m.code] = await prisma.machine.upsert({
      where: { machineCode: m.code },
      update: {},
      create: {
        companyId,
        machineCode: m.code,
        name: m.name,
        departmentId: departments["Production"].id,
        purchaseCost: randomBetween(200000, 900000),
        status: "RUNNING",
      },
    });
  }

  // ── Consumables (renamed from SparePart) ──────────────────────
  const consumableDefs = [
    { partNumber: "BRG-6205", name: "Bearing 6205", category: "Bearings", currentStock: 12, minimumStock: 10, unitCost: 350 },
    { partNumber: "HTR-HC204", name: "Heater Coil HC-204", category: "Electrical components", currentStock: 3, minimumStock: 10, unitCost: 1200 },
    { partNumber: "BLT-MB101", name: "Motor Belt MB-101", category: "Belts", currentStock: 18, minimumStock: 8, unitCost: 650 },
    { partNumber: "BLD-CB20", name: "Cutting Blade CB-20", category: "Blades", currentStock: 6, minimumStock: 5, unitCost: 900 },
  ];
  const consumables: Record<string, Awaited<ReturnType<typeof prisma.consumable.create>>> = {};
  for (const s of consumableDefs) {
    consumables[s.partNumber] = await prisma.consumable.upsert({
      where: { partNumber: s.partNumber },
      update: {},
      create: { ...s, companyId },
    });
  }

  // ── Notification rules (renamed from AlertRule) ──────────────
  const ruleDefs: { key: string; name: string; severity: "INFO" | "WARNING" | "CRITICAL"; conditionJson: object }[] = [
    { key: "same_spare_same_machine", name: "Repeated spare replacement", severity: "CRITICAL", conditionJson: { withinDays: 7, minCount: 2 } },
    { key: "critical_repeated_failure", name: "Critical repeated failure", severity: "CRITICAL", conditionJson: { withinDays: 30, minCount: 3 } },
    { key: "abnormal_spare_consumption", name: "Abnormal spare consumption", severity: "WARNING", conditionJson: { comparedTo: "historical_average" } },
    { key: "supplier_quality_issue", name: "Supplier quality issue", severity: "WARNING", conditionJson: { minFailuresAcrossSpares: 3, withinDays: 60 } },
    { key: "fuel_efficiency_drop", name: "Unusual fuel consumption", severity: "WARNING", conditionJson: { thresholdRatio: 0.75 } },
    { key: "low_stock", name: "Low spare stock", severity: "WARNING", conditionJson: {} },
    { key: "budget_warning", name: "Budget nearing limit", severity: "WARNING", conditionJson: { thresholdRatio: 0.8 } },
    { key: "budget_exceeded", name: "Budget exceeded", severity: "CRITICAL", conditionJson: { thresholdRatio: 1.0 } },
  ];
  for (const r of ruleDefs) {
    await prisma.notificationRule.upsert({
      where: { key: r.key },
      update: {},
      create: { companyId, key: r.key, name: r.name, severity: r.severity, conditionJson: r.conditionJson },
    });
  }

  // ── Sample expenses across the last 6 months, with approvals + payments ─
  const deptList = Object.values(departments);
  const existingExpenseCount = await prisma.expense.count();
  const paidExpenseIds: { id: string; expenseNumber: string; total: number; vendorId: string | null }[] = [];
  if (existingExpenseCount === 0) {
    let seq = 1;
    for (let i = 0; i < 90; i++) {
      const date = daysAgo(Math.floor(Math.random() * 180));
      const sub = pick(subcategories);
      const dept = pick(deptList);
      const amount = randomBetween(500, 45000);
      const tax = Math.round(amount * 0.18 * 100) / 100;
      const total = amount + tax;
      const statusRoll = Math.random();
      const status = statusRoll < 0.6 ? "PAID" : statusRoll < 0.8 ? "APPROVED" : statusRoll < 0.9 ? "SUBMITTED" : "REJECTED";
      const expenseNumber = `EXP-${String(seq++).padStart(6, "0")}`;
      const vendorId = Math.random() > 0.4 ? pick(Object.values(vendors)).id : null;
      const expense = await prisma.expense.create({
        data: {
          companyId,
          expenseNumber,
          expenseDate: date,
          categoryId: sub.categoryId,
          subcategoryId: sub.id,
          amount,
          taxAmount: tax,
          totalAmount: total,
          departmentId: dept.id,
          employeeId: users[ROLES.EMPLOYEE].id,
          vendorId,
          paymentMethod: pick(["CASH", "UPI", "BANK_TRANSFER", "NEFT", "CHEQUE"]) as never,
          description: `${sub.name} expense — ${dept.name}`,
          status: status as never,
        },
      });
      await prisma.expenseApproval.create({
        data: {
          expenseId: expense.id,
          approvalLevel: 1,
          action: "SUBMITTED",
          actedById: users[ROLES.EMPLOYEE].id,
          fromStatus: "DRAFT",
          toStatus: "SUBMITTED",
        },
      });
      if (status !== "SUBMITTED") {
        await prisma.expenseApproval.create({
          data: {
            expenseId: expense.id,
            approvalLevel: 1,
            action: status === "REJECTED" ? "REJECTED" : "APPROVED",
            actedById: users[ROLES.ADMIN].id,
            fromStatus: "SUBMITTED",
            toStatus: status === "REJECTED" ? "REJECTED" : "APPROVED",
            remarks: status === "REJECTED" ? "Invoice does not match submitted amount." : null,
          },
        });
      }
      if (status === "PAID") {
        await prisma.expenseApproval.create({
          data: {
            expenseId: expense.id,
            approvalLevel: 1,
            action: "PAID",
            actedById: users[ROLES.ACCOUNTS].id,
            fromStatus: "APPROVED",
            toStatus: "PAID",
          },
        });
        paidExpenseIds.push({ id: expense.id, expenseNumber: expense.expenseNumber, total, vendorId });
      }
      // A handful of sample attachments — a real generated PDF actually
      // uploaded to Cloudinary, so demo links work instead of 404ing.
      if (i % 12 === 0) {
        const pdfBuffer = await buildPlaceholderReceiptPdf(expenseNumber, total);
        const storageKey = await uploadSeedAttachment(pdfBuffer, `mecs_seed_${expenseNumber}`);
        if (!storageKey) continue;
        await prisma.expenseAttachment.create({
          data: {
            expenseId: expense.id,
            fileName: `receipt-${expenseNumber}.pdf`,
            storageKey,
            fileType: "application/pdf",
            fileSizeBytes: BigInt(pdfBuffer.byteLength),
            uploadedById: users[ROLES.EMPLOYEE].id,
          },
        });
      }
    }

    // Payments for a sample of the paid expenses (vendor-billed ones only).
    let paySeq = 1;
    for (const exp of paidExpenseIds.filter((e) => e.vendorId).slice(0, 20)) {
      await prisma.payment.create({
        data: {
          companyId,
          paymentNumber: `PAY-${String(paySeq++).padStart(6, "0")}`,
          expenseId: exp.id,
          vendorId: exp.vendorId!,
          amount: exp.total,
          paymentDate: daysAgo(Math.floor(Math.random() * 30)),
          method: pick(["CASH", "UPI", "BANK_TRANSFER", "NEFT", "CHEQUE"]) as never,
          status: "PAID",
          createdById: users[ROLES.ACCOUNTS].id,
        },
      });
    }
  }

  // ── Fuel transactions (with one anomaly), driver per-record ─
  const fuelCount = await prisma.fuelTransaction.count();
  if (fuelCount === 0) {
    let odo1 = 44000;
    for (let i = 6; i >= 1; i--) {
      const distance = randomBetween(280, 340);
      const litres = i === 2 ? randomBetween(55, 60) : randomBetween(28, 34); // anomaly: much thirstier on one fill
      const rate = randomBetween(94, 99);
      odo1 += distance;
      const efficiency = Math.round((distance / litres) * 1000) / 1000;
      await prisma.fuelTransaction.create({
        data: {
          vehicleId: vehicle1.id,
          driverId: driver1.id,
          date: daysAgo(i * 15),
          fuelType: "DIESEL",
          fuelStation: "Anna Fuel Station",
          litres,
          ratePerLitre: rate,
          totalAmount: Math.round(litres * rate * 100) / 100,
          odometerReading: odo1,
          previousOdometerReading: odo1 - distance,
          distanceTravelled: distance,
          efficiencyKmpl: efficiency,
          isAnomaly: efficiency < 7,
          anomalyNote: efficiency < 7 ? "Efficiency dropped below 75% of historical average" : null,
        },
      });
    }
  }

  // ── Maintenance: requests -> records, with a repeated-bearing scenario ─
  const maintCount = await prisma.maintenanceRecord.count();
  if (maintCount === 0) {
    const req1 = await prisma.maintenanceRequest.create({
      data: {
        machineId: machines["EXT-02"].id,
        requestedById: users[ROLES.MAINTENANCE_MANAGER].id,
        problemDescription: "Bearing noise on drive shaft",
        priority: "HIGH",
        status: "RESOLVED",
      },
    });
    const m1 = await prisma.maintenanceRecord.create({
      data: {
        maintenanceRequestId: req1.id,
        ticketNumber: "MNT-000001",
        machineId: machines["EXT-02"].id,
        maintenanceType: "BREAKDOWN",
        technician: "Ramesh Babu",
        labourCost: 800,
        consumablesCost: 350,
        otherCost: 0,
        totalCost: 1150,
        downtimeMinutes: 120,
        startTime: daysAgo(6),
        createdById: users[ROLES.MAINTENANCE_MANAGER].id,
      },
    });
    await prisma.maintenanceSpare.create({
      data: {
        maintenanceRecordId: m1.id,
        consumableId: consumables["BRG-6205"].id,
        quantity: 1,
        unitCost: 350,
        totalCost: 350,
        issuedById: users[ROLES.MAINTENANCE_MANAGER].id,
      },
    });
    await prisma.consumableStockMovement.create({
      data: {
        consumableId: consumables["BRG-6205"].id,
        movementType: "ISSUE",
        quantity: -1,
        referenceType: "maintenance_record",
        referenceId: m1.id,
        unitCost: 350,
        totalCost: 350,
        performedById: users[ROLES.MAINTENANCE_MANAGER].id,
      },
    });

    // Second replacement of the same bearing on the same machine 3 days later — triggers rule 1.
    const req2 = await prisma.maintenanceRequest.create({
      data: {
        machineId: machines["EXT-02"].id,
        requestedById: users[ROLES.MAINTENANCE_MANAGER].id,
        problemDescription: "Same bearing failed again",
        priority: "HIGH",
        status: "RESOLVED",
      },
    });
    const m2 = await prisma.maintenanceRecord.create({
      data: {
        maintenanceRequestId: req2.id,
        ticketNumber: "MNT-000002",
        machineId: machines["EXT-02"].id,
        maintenanceType: "CORRECTIVE",
        technician: "Ramesh Babu",
        labourCost: 800,
        consumablesCost: 350,
        otherCost: 0,
        totalCost: 1150,
        downtimeMinutes: 90,
        startTime: daysAgo(3),
        createdById: users[ROLES.MAINTENANCE_MANAGER].id,
      },
    });
    await prisma.maintenanceSpare.create({
      data: {
        maintenanceRecordId: m2.id,
        consumableId: consumables["BRG-6205"].id,
        quantity: 1,
        unitCost: 350,
        totalCost: 350,
        issuedById: users[ROLES.MAINTENANCE_MANAGER].id,
      },
    });
    await prisma.consumableStockMovement.create({
      data: {
        consumableId: consumables["BRG-6205"].id,
        movementType: "ISSUE",
        quantity: -1,
        referenceType: "maintenance_record",
        referenceId: m2.id,
        unitCost: 350,
        totalCost: 350,
        performedById: users[ROLES.MAINTENANCE_MANAGER].id,
      },
    });

    // A couple of recurring maintenance schedules (decoupled from any single record).
    await prisma.maintenanceSchedule.createMany({
      data: [
        { machineId: machines["EXT-01"].id, scheduleName: "Monthly lubrication", frequencyDays: 30, nextDueDate: daysAgo(-10) },
        { machineId: machines["PRINT-01"].id, scheduleName: "Quarterly service", frequencyDays: 90, nextDueDate: daysAgo(-45) },
      ],
    });
  }

  // A few standalone stock-movement ledger entries using only the new,
  // correct movement types with correct positive/negative signs.
  const stockMovementCount = await prisma.consumableStockMovement.count();
  if (stockMovementCount <= 2) {
    await prisma.consumableStockMovement.createMany({
      data: [
        { consumableId: consumables["BLT-MB101"].id, movementType: "PURCHASE", quantity: 20, unitCost: 650, totalCost: 13000, performedById: users[ROLES.PURCHASE_MANAGER].id, notes: "Opening stock purchase" },
        { consumableId: consumables["HTR-HC204"].id, movementType: "PURCHASE", quantity: 5, unitCost: 1200, totalCost: 6000, performedById: users[ROLES.PURCHASE_MANAGER].id },
        { consumableId: consumables["BLD-CB20"].id, movementType: "DAMAGED", quantity: -1, performedById: users[ROLES.MAINTENANCE_MANAGER].id, notes: "Blade chipped during changeover" },
        { consumableId: consumables["BRG-6205"].id, movementType: "RETURN", quantity: 1, unitCost: 350, totalCost: 350, performedById: users[ROLES.MAINTENANCE_MANAGER].id, notes: "Unused unit returned to store" },
      ],
    });
  }

  // ── Transport trips ──────────────────────────────────────────
  const tripCount = await prisma.transportTrip.count();
  if (tripCount === 0) {
    for (let i = 0; i < 10; i++) {
      const qty = randomBetween(800, 3000);
      const freight = randomBetween(2000, 9000);
      const loading = randomBetween(200, 600);
      const unloading = randomBetween(200, 600);
      const toll = randomBetween(0, 400);
      const total = Math.round((freight + loading + unloading + toll) * 100) / 100;
      await prisma.transportTrip.create({
        data: {
          companyId,
          tripNumber: `TRP-${String(i + 1).padStart(6, "0")}`,
          date: daysAgo(i * 12),
          vehicleId: pick([vehicle1.id, vehicle2.id]),
          driverId: pick([driver1.id, driver2.id]),
          transporterId: transporters["Chennai Freight Carriers"].id,
          source: "Chennai Plant",
          destination: pick(["Coimbatore", "Madurai", "Trichy", "Salem"]),
          material: "Plastic granules",
          quantity: qty,
          unit: "kg",
          freight,
          loadingCost: loading,
          unloadingCost: unloading,
          toll,
          totalCost: total,
          paymentStatus: pick(["PENDING", "PAID"]) as never,
        },
      });
    }
  }

  // ── Procurement: purchase_request -> purchase_order -> goods_receipt ─
  const purchaseRequestCount = await prisma.purchaseRequest.count();
  if (purchaseRequestCount === 0) {
    const pr = await prisma.purchaseRequest.create({
      data: {
        companyId,
        requestNumber: "PR-000001",
        requestedById: users[ROLES.MAINTENANCE_MANAGER].id,
        departmentId: departments["Maintenance"].id,
        status: "CONVERTED",
        items: {
          create: [
            { consumableId: consumables["BRG-6205"].id, description: "Bearing 6205 restock", quantity: 20, estimatedUnitPrice: 350 },
          ],
        },
      },
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        companyId,
        poNumber: "PO-000001",
        purchaseRequestId: pr.id,
        vendorId: vendors["SKF Bearing Distributors"].id,
        status: "RECEIVED",
        expectedDelivery: daysAgo(-7),
        totalAmount: 7000,
        createdById: users[ROLES.PURCHASE_MANAGER].id,
        items: {
          create: [
            { consumableId: consumables["BRG-6205"].id, description: "Bearing 6205 restock", quantity: 20, unitPrice: 350, total: 7000 },
          ],
        },
      },
      include: { items: true },
    });

    const stockMovement = await prisma.consumableStockMovement.create({
      data: {
        consumableId: consumables["BRG-6205"].id,
        movementType: "PURCHASE",
        quantity: 20,
        referenceType: "purchase_order",
        referenceId: po.id,
        unitCost: 350,
        totalCost: 7000,
        performedById: users[ROLES.PURCHASE_MANAGER].id,
      },
    });

    const goodsReceipt = await prisma.goodsReceipt.create({
      data: {
        purchaseOrderId: po.id,
        receiptNumber: "GR-000001",
        receivedDate: daysAgo(-7),
        receivedById: users[ROLES.PURCHASE_MANAGER].id,
        items: {
          create: [
            { purchaseOrderItemId: po.items[0].id, quantityReceived: 20, stockMovementId: stockMovement.id },
          ],
        },
      },
    });
    await prisma.purchaseOrderItem.update({ where: { id: po.items[0].id }, data: { receivedQuantity: 20 } });
    void goodsReceipt;
  }

  // ── Budgets (1 parent + 1 allocation each, one intentionally over-spent) ─
  const budgetCount = await prisma.budget.count();
  if (budgetCount === 0) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    await prisma.budget.create({
      data: {
        companyId,
        name: "Maintenance Budget — this month",
        period: "MONTHLY",
        periodStart,
        periodEnd,
        totalAmount: 300000,
        createdById: users[ROLES.SUPER_ADMIN].id,
        allocations: { create: { departmentId: departments["Maintenance"].id, allocatedAmount: 300000 } },
      },
    });
    await prisma.budget.create({
      data: {
        companyId,
        name: "Transportation Budget — this month",
        period: "MONTHLY",
        periodStart,
        periodEnd,
        totalAmount: 150000,
        createdById: users[ROLES.SUPER_ADMIN].id,
        allocations: { create: { departmentId: departments["Transportation"].id, allocatedAmount: 150000 } },
      },
    });
  }

  // ── Sample notifications, audit logs, report jobs ────────────
  const notificationCount = await prisma.notification.count();
  if (notificationCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          companyId,
          roleId: roles[ROLES.ADMIN].id,
          type: "expense_awaiting_approval",
          severity: "INFO",
          title: "Expenses awaiting approval",
          message: "There are expenses submitted for review.",
          entityType: "Expense",
        },
        {
          companyId,
          userId: users[ROLES.TRANSPORT_MANAGER].id,
          type: "document_expiring",
          severity: "WARNING",
          title: "Vehicle document expiring soon",
          message: `${vehicle2.registrationNumber}: pollution certificate has expired.`,
          entityType: "Vehicle",
          entityId: vehicle2.id,
        },
      ],
    });
  }

  const auditLogCount = await prisma.auditLog.count();
  if (auditLogCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        { companyId, userId: users[ROLES.SUPER_ADMIN].id, action: "SEED", entityType: "Company", entityId: companyId, newValue: { note: "Initial ERP seed" } },
        { companyId, userId: users[ROLES.ADMIN].id, action: "LOGIN", entityType: "User", entityId: users[ROLES.ADMIN].id },
      ],
    });
  }

  const reportJobCount = await prisma.reportJob.count();
  if (reportJobCount === 0) {
    await prisma.reportJob.createMany({
      data: [
        {
          companyId,
          requestedById: users[ROLES.ACCOUNTS].id,
          reportType: "expenses",
          status: "COMPLETED",
          outputStorageKey: "seed-report-expenses.csv",
          completedAt: daysAgo(1),
        },
        {
          companyId,
          requestedById: users[ROLES.ADMIN].id,
          reportType: "budgets",
          status: "COMPLETED",
          outputStorageKey: "seed-report-budgets.csv",
          completedAt: daysAgo(2),
        },
      ],
    });
  }

  console.log("Seed complete.");
  console.log("Login with any of these (password: Passw0rd!):");
  for (const u of userDefs) console.log(`  ${u.role.padEnd(20)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
