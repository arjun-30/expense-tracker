/**
 * Deterministic, pure calculation services (§45). No I/O — every function
 * here is trivially unit-testable and is the single place these formulas live,
 * so UI and reports never recompute them differently.
 */

export function expenseTotal(subtotal: number, tax: number, discount: number): number {
  return round2(subtotal + tax - discount);
}

export function fuelEfficiencyKmpl(distanceKm: number, litres: number): number | null {
  if (litres <= 0) return null;
  return round3(distanceKm / litres);
}

export function fuelCostPerKm(fuelAmount: number, distanceKm: number): number | null {
  if (distanceKm <= 0) return null;
  return round3(fuelAmount / distanceKm);
}

export function transportCostPerKg(totalCost: number, quantityKg: number): number | null {
  if (quantityKg <= 0) return null;
  return round3(totalCost / quantityKg);
}

export function transportCostPerTrip(totalCost: number, numberOfTrips: number): number | null {
  if (numberOfTrips <= 0) return null;
  return round2(totalCost / numberOfTrips);
}

export function maintenanceTotalCost(labourCost: number, sparePartsCost: number, otherCost: number): number {
  return round2(labourCost + sparePartsCost + otherCost);
}

export function budgetVariance(budget: number, actual: number): number {
  return round2(budget - actual);
}

export function budgetUtilizationRatio(budget: number, actual: number): number | null {
  if (budget <= 0) return null;
  return round3(actual / budget);
}

/** Replacements per 30-day window, e.g. 3 replacements over 45 days -> 2 per 30 days. */
export function spareReplacementFrequency(replacementCount: number, windowDays: number): number {
  if (windowDays <= 0) return 0;
  return round3((replacementCount / windowDays) * 30);
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round3(((current - previous) / Math.abs(previous)) * 100);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}
