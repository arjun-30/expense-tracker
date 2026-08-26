import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
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
      where: { code },
      update: {},
      create: { name, code },
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
      where: { code },
      update: {},
      create: { name, code, departmentId: departments[dept].id },
    });
  }

  // ── Expense categories ───────────────────────────────────────
  const categoryTree: Record<string, string[]> = {
    Fuel: ["Diesel", "Petrol", "CNG", "Other"],
    Transportation: ["Freight", "Loading", "Unloading", "Toll", "Parking", "Delivery", "Vehicle hire"],
    Machinery: ["Maintenance", "Repair", "Service", "AMC", "Machine parts"],
    "Spare Parts": ["Bearings", "Belts", "Motors", "Heaters", "Blades", "Rollers", "Electrical components", "Mechanical components", "Other"],
    Printing: ["Ink", "Solvents", "Plates", "Cylinders", "Chemicals", "Printing maintenance"],
    Office: ["Rent", "Electricity", "Internet", "Telephone", "Stationery", "Software", "Courier", "Office maintenance"],
    Production: ["Consumables", "Labour", "Utilities", "Packaging", "Outsourcing"],
  };
  const categories: Record<string, Awaited<ReturnType<typeof prisma.expenseCategory.create>>> = {};
  const subcategories: Awaited<ReturnType<typeof prisma.expenseCategory.create>>[] = [];
  for (const [parentName, children] of Object.entries(categoryTree)) {
    const code = parentName.toUpperCase().replace(/\s+/g, "_");
    const parent = await prisma.expenseCategory.upsert({
      where: { code },
      update: {},
      create: { name: parentName, code },
    });
    categories[parentName] = parent;
    for (const child of children) {
      const childCode = `${code}_${child.toUpperCase().replace(/\s+/g, "_")}`;
      const sub = await prisma.expenseCategory.upsert({
        where: { code: childCode },
        update: {},
        create: { name: child, code: childCode, parentId: parent.id },
      });
      subcategories.push(sub);
    }
  }

  // ── Users (one per role) ─────────────────────────────────────
  const password = await hash("Passw0rd!");
  const userDefs: { name: string; email: string; role: string; dept?: string }[] = [
    { name: "Ashwin Rao", email: "superadmin@mecs.local", role: "SUPER_ADMIN" },
    { name: "Meera Krishnan", email: "admin@mecs.local", role: "ADMIN" },
    { name: "Divya Suresh", email: "accounts@mecs.local", role: "ACCOUNTS", dept: "Administration" },
    { name: "Karthik Iyer", email: "purchase@mecs.local", role: "PURCHASE_MANAGER", dept: "Warehouse" },
    { name: "Ramesh Babu", email: "maintenance@mecs.local", role: "MAINTENANCE_MANAGER", dept: "Maintenance" },
    { name: "Suresh Kumar", email: "transport@mecs.local", role: "TRANSPORT_MANAGER", dept: "Transportation" },
    { name: "Priya Natarajan", email: "employee@mecs.local", role: "EMPLOYEE", dept: "Production" },
  ];
  const users: Record<string, Awaited<ReturnType<typeof prisma.user.create>>> = {};
  for (const u of userDefs) {
    users[u.role] = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash: password,
        role: u.role as never,
        departmentId: u.dept ? departments[u.dept].id : null,
      },
    });
  }

  // ── Vendors ──────────────────────────────────────────────────
  const vendorDefs = [
    { name: "Tamilnadu Polymers Pvt Ltd", category: "Raw Material", gstNumber: "33AAAAA0000A1Z5" },
    { name: "SKF Bearing Distributors", category: "Spares", gstNumber: "33BBBBB1111B2Z6" },
    { name: "Chennai Freight Carriers", category: "Transportation", gstNumber: "33CCCCC2222C3Z7" },
    { name: "Anna Fuel Station", category: "Fuel", gstNumber: "33DDDDD3333D4Z8" },
    { name: "Precision Printing Supplies", category: "Printing", gstNumber: "33EEEEE4444E5Z9" },
  ];
  const vendors: Record<string, Awaited<ReturnType<typeof prisma.vendor.create>>> = {};
  for (const v of vendorDefs) {
    const existing = await prisma.vendor.findFirst({ where: { name: v.name } });
    vendors[v.name] = existing ?? (await prisma.vendor.create({ data: v }));
  }

  // ── Drivers & Vehicles ───────────────────────────────────────
  const driver1 = await prisma.driver.upsert({
    where: { id: "seed-driver-1" },
    update: {},
    create: { id: "seed-driver-1", name: "Murugan S", phone: "9840011122", licenseNumber: "TN0120210001234" },
  });
  const driver2 = await prisma.driver.upsert({
    where: { id: "seed-driver-2" },
    update: {},
    create: { id: "seed-driver-2", name: "Selvam K", phone: "9840033344", licenseNumber: "TN0120200005678" },
  });

  const vehicle1 = await prisma.vehicle.upsert({
    where: { registrationNumber: "TN-01-AB-1234" },
    update: {},
    create: {
      registrationNumber: "TN-01-AB-1234",
      vehicleType: "Truck",
      manufacturer: "Tata",
      model: "407",
      year: 2021,
      driverId: driver1.id,
      departmentId: departments["Transportation"].id,
      currentOdometer: 45000,
      insuranceExpiry: daysAgo(-120),
      pollutionExpiry: daysAgo(-20),
      fitnessExpiry: daysAgo(-200),
    },
  });
  const vehicle2 = await prisma.vehicle.upsert({
    where: { registrationNumber: "TN-01-CD-5678" },
    update: {},
    create: {
      registrationNumber: "TN-01-CD-5678",
      vehicleType: "Van",
      manufacturer: "Mahindra",
      model: "Bolero Pickup",
      year: 2022,
      driverId: driver2.id,
      departmentId: departments["Transportation"].id,
      currentOdometer: 28000,
      insuranceExpiry: daysAgo(-300),
      pollutionExpiry: daysAgo(15), // already expired -> demo document-expiry alert
      fitnessExpiry: daysAgo(-150),
    },
  });

  // ── Machines ─────────────────────────────────────────────────
  const machineDefs = [
    { code: "EXT-01", name: "Extruder-01", category: "Extrusion" },
    { code: "EXT-02", name: "Extruder-02", category: "Extrusion" },
    { code: "PRINT-01", name: "Printing-Machine-01", category: "Printing" },
    { code: "CUT-01", name: "Cutting-Machine-01", category: "Cutting" },
  ];
  const machines: Record<string, Awaited<ReturnType<typeof prisma.machine.create>>> = {};
  for (const m of machineDefs) {
    machines[m.code] = await prisma.machine.upsert({
      where: { machineCode: m.code },
      update: {},
      create: {
        machineCode: m.code,
        name: m.name,
        category: m.category,
        departmentId: departments["Production"].id,
        purchasePrice: randomBetween(200000, 900000),
        status: "RUNNING",
      },
    });
  }

  // ── Spare parts ──────────────────────────────────────────────
  const spareDefs = [
    { partNumber: "BRG-6205", name: "Bearing 6205", category: "Bearings", currentStock: 12, minimumStock: 10, purchasePrice: 350 },
    { partNumber: "HTR-HC204", name: "Heater Coil HC-204", category: "Electrical components", currentStock: 3, minimumStock: 10, purchasePrice: 1200 },
    { partNumber: "BLT-MB101", name: "Motor Belt MB-101", category: "Belts", currentStock: 18, minimumStock: 8, purchasePrice: 650 },
    { partNumber: "BLD-CB20", name: "Cutting Blade CB-20", category: "Blades", currentStock: 6, minimumStock: 5, purchasePrice: 900 },
  ];
  const spares: Record<string, Awaited<ReturnType<typeof prisma.sparePart.create>>> = {};
  for (const s of spareDefs) {
    spares[s.partNumber] = await prisma.sparePart.upsert({
      where: { partNumber: s.partNumber },
      update: {},
      create: { ...s, supplierId: vendors["SKF Bearing Distributors"].id },
    });
  }

  // ── Alert rules (§44 rules engine) ──────────────────────────
  const ruleDefs = [
    { key: "same_spare_same_machine", name: "Repeated spare replacement", module: "spares", severity: "CRITICAL", conditionJson: { withinDays: 7, minCount: 2 } },
    { key: "critical_repeated_failure", name: "Critical repeated failure", module: "spares", severity: "CRITICAL", conditionJson: { withinDays: 30, minCount: 3 } },
    { key: "abnormal_spare_consumption", name: "Abnormal spare consumption", module: "spares", severity: "WARNING", conditionJson: { comparedTo: "historical_average" } },
    { key: "supplier_quality_issue", name: "Supplier quality issue", module: "spares", severity: "WARNING", conditionJson: { minFailuresAcrossSpares: 3, withinDays: 60 } },
    { key: "fuel_efficiency_drop", name: "Unusual fuel consumption", module: "fuel", severity: "WARNING", conditionJson: { thresholdRatio: 0.75 } },
    { key: "low_stock", name: "Low spare stock", module: "spares", severity: "WARNING", conditionJson: {} },
    { key: "budget_warning", name: "Budget nearing limit", module: "budgets", severity: "WARNING", conditionJson: { thresholdRatio: 0.8 } },
    { key: "budget_exceeded", name: "Budget exceeded", module: "budgets", severity: "CRITICAL", conditionJson: { thresholdRatio: 1.0 } },
  ];
  for (const r of ruleDefs) {
    await prisma.alertRule.upsert({
      where: { key: r.key },
      update: {},
      create: r as never,
    });
  }

  // ── Sample expenses across the last 6 months ────────────────
  const deptList = Object.values(departments);
  const existingExpenseCount = await prisma.expense.count();
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
      const expense = await prisma.expense.create({
        data: {
          expenseNumber,
          date,
          categoryId: sub.parentId!,
          subcategoryId: sub.id,
          amount,
          taxAmount: tax,
          totalAmount: total,
          departmentId: dept.id,
          employeeId: users.EMPLOYEE.id,
          vendorId: Math.random() > 0.4 ? pick(Object.values(vendors)).id : null,
          paymentMethod: pick(["CASH", "UPI", "BANK_TRANSFER", "NEFT", "CHEQUE"]) as never,
          paymentStatus: status === "PAID" ? "PAID" : "PENDING",
          description: `${sub.name} expense — ${dept.name}`,
          status: status as never,
          approvedById: status !== "SUBMITTED" ? users.ADMIN.id : null,
          approvedAt: status !== "SUBMITTED" ? date : null,
        },
      });
      await prisma.expenseApproval.create({
        data: {
          expenseId: expense.id,
          action: "SUBMITTED",
          actedById: users.EMPLOYEE.id,
          fromStatus: "DRAFT",
          toStatus: "SUBMITTED",
        },
      });
      if (status !== "SUBMITTED") {
        await prisma.expenseApproval.create({
          data: {
            expenseId: expense.id,
            action: status === "REJECTED" ? "REJECTED" : "APPROVED",
            actedById: users.ADMIN.id,
            fromStatus: "SUBMITTED",
            toStatus: status as never,
            remarks: status === "REJECTED" ? "Invoice does not match submitted amount." : null,
          },
        });
      }
    }
  }

  // ── Fuel transactions (with one anomaly) ────────────────────
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
          costPerKm: Math.round(((litres * rate) / distance) * 1000) / 1000,
          isAnomaly: efficiency < 7,
          anomalyNote: efficiency < 7 ? "Efficiency dropped below 75% of historical average" : null,
        },
      });
    }
  }

  // ── Maintenance with a repeated-bearing-replacement scenario ─
  const maintCount = await prisma.maintenanceRecord.count();
  if (maintCount === 0) {
    const m1 = await prisma.maintenanceRecord.create({
      data: {
        ticketNumber: "MNT-000001",
        machineId: machines["EXT-02"].id,
        date: daysAgo(6),
        maintenanceType: "BREAKDOWN",
        problem: "Bearing noise on drive shaft",
        technician: "Ramesh Babu",
        labourCost: 800,
        sparePartsCost: 350,
        otherCost: 0,
        totalCost: 1150,
        downtimeMinutes: 120,
        createdById: users.MAINTENANCE_MANAGER.id,
      },
    });
    await prisma.maintenanceSpare.create({
      data: {
        maintenanceRecordId: m1.id,
        sparePartId: spares["BRG-6205"].id,
        quantity: 1,
        unitCost: 350,
        totalCost: 350,
        issuedById: users.MAINTENANCE_MANAGER.id,
      },
    });
    await prisma.inventoryTransaction.create({
      data: {
        sparePartId: spares["BRG-6205"].id,
        type: "ISSUE",
        quantity: -1,
        machineId: machines["EXT-02"].id,
        unitCost: 350,
        totalCost: 350,
        performedById: users.MAINTENANCE_MANAGER.id,
      },
    });

    // Second replacement of the same bearing on the same machine 3 days later — triggers rule 1.
    const m2 = await prisma.maintenanceRecord.create({
      data: {
        ticketNumber: "MNT-000002",
        machineId: machines["EXT-02"].id,
        date: daysAgo(3),
        maintenanceType: "CORRECTIVE",
        problem: "Same bearing failed again",
        technician: "Ramesh Babu",
        labourCost: 800,
        sparePartsCost: 350,
        otherCost: 0,
        totalCost: 1150,
        downtimeMinutes: 90,
        createdById: users.MAINTENANCE_MANAGER.id,
      },
    });
    await prisma.maintenanceSpare.create({
      data: {
        maintenanceRecordId: m2.id,
        sparePartId: spares["BRG-6205"].id,
        quantity: 1,
        unitCost: 350,
        totalCost: 350,
        issuedById: users.MAINTENANCE_MANAGER.id,
      },
    });
    await prisma.inventoryTransaction.create({
      data: {
        sparePartId: spares["BRG-6205"].id,
        type: "ISSUE",
        quantity: -1,
        machineId: machines["EXT-02"].id,
        unitCost: 350,
        totalCost: 350,
        performedById: users.MAINTENANCE_MANAGER.id,
      },
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
          tripNumber: `TRP-${String(i + 1).padStart(6, "0")}`,
          date: daysAgo(i * 12),
          vehicleId: pick([vehicle1.id, vehicle2.id]),
          transporterId: vendors["Chennai Freight Carriers"].id,
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
          costPerKg: Math.round((total / qty) * 1000) / 1000,
          paymentStatus: pick(["PENDING", "PAID"]) as never,
        },
      });
    }
  }

  // ── Budgets (one intentionally over-spent) ──────────────────
  const budgetCount = await prisma.budget.count();
  if (budgetCount === 0) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    await prisma.budget.create({
      data: {
        name: "Maintenance Budget — this month",
        departmentId: departments["Maintenance"].id,
        period: "MONTHLY",
        periodStart,
        periodEnd,
        amount: 300000,
        createdById: users.SUPER_ADMIN.id,
      },
    });
    await prisma.budget.create({
      data: {
        name: "Transportation Budget — this month",
        departmentId: departments["Transportation"].id,
        period: "MONTHLY",
        periodStart,
        periodEnd,
        amount: 150000,
        createdById: users.SUPER_ADMIN.id,
      },
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
