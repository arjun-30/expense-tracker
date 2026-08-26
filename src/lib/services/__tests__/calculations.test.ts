import { describe, it, expect } from "vitest";
import {
  expenseTotal,
  fuelEfficiencyKmpl,
  fuelCostPerKm,
  transportCostPerKg,
  transportCostPerTrip,
  maintenanceTotalCost,
  budgetVariance,
  budgetUtilizationRatio,
  spareReplacementFrequency,
  percentChange,
} from "@/lib/services/calculations";

describe("expenseTotal", () => {
  it("adds tax and subtracts discount", () => {
    expect(expenseTotal(1000, 180, 50)).toBe(1130);
  });
  it("rounds to 2 decimals", () => {
    expect(expenseTotal(10.005, 0, 0)).toBe(10.01);
  });
});

describe("fuelEfficiencyKmpl", () => {
  it("computes distance / litres", () => {
    expect(fuelEfficiencyKmpl(340, 40)).toBe(8.5);
  });
  it("returns null for zero litres", () => {
    expect(fuelEfficiencyKmpl(100, 0)).toBeNull();
  });
});

describe("fuelCostPerKm", () => {
  it("computes amount / distance", () => {
    expect(fuelCostPerKm(3400, 340)).toBe(10);
  });
  it("returns null for zero distance", () => {
    expect(fuelCostPerKm(100, 0)).toBeNull();
  });
});

describe("transportCostPerKg", () => {
  it("computes cost / quantity", () => {
    expect(transportCostPerKg(5000, 1000)).toBe(5);
  });
  it("returns null for zero quantity", () => {
    expect(transportCostPerKg(5000, 0)).toBeNull();
  });
});

describe("transportCostPerTrip", () => {
  it("computes cost / number of trips", () => {
    expect(transportCostPerTrip(9000, 3)).toBe(3000);
  });
});

describe("maintenanceTotalCost", () => {
  it("sums labour, spares and other cost", () => {
    expect(maintenanceTotalCost(800, 350, 0)).toBe(1150);
  });
});

describe("budgetVariance", () => {
  it("is positive when under budget", () => {
    expect(budgetVariance(300000, 257500)).toBe(42500);
  });
  it("is negative when over budget", () => {
    expect(budgetVariance(300000, 342500)).toBe(-42500);
  });
});

describe("budgetUtilizationRatio", () => {
  it("computes actual / budget", () => {
    expect(budgetUtilizationRatio(100000, 80000)).toBe(0.8);
  });
  it("returns null for zero budget", () => {
    expect(budgetUtilizationRatio(0, 100)).toBeNull();
  });
});

describe("spareReplacementFrequency", () => {
  it("normalizes to a 30-day window", () => {
    // 3 replacements over 45 days -> 2 per 30 days
    expect(spareReplacementFrequency(3, 45)).toBe(2);
  });
  it("returns 0 for zero window", () => {
    expect(spareReplacementFrequency(3, 0)).toBe(0);
  });
});

describe("percentChange", () => {
  it("computes percentage increase", () => {
    expect(percentChange(110, 100)).toBe(10);
  });
  it("computes percentage decrease", () => {
    expect(percentChange(90, 100)).toBe(-10);
  });
  it("returns null when previous is zero", () => {
    expect(percentChange(50, 0)).toBeNull();
  });
});
