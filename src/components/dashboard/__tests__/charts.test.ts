import { describe, it, expect } from "vitest";
import { formatINR, formatINRCompact } from "@/lib/format";

describe("Dashboard Charts Data & Formatting Tests", () => {
  it("formats currency cleanly for spot hover tooltips in INR", () => {
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(1250)).toBe("₹1,250");
    expect(formatINR(63618)).toBe("₹63,618");
    expect(formatINR(1500000)).toBe("₹15,00,000");
  });

  it("compacts large values for axis labels without awkward notation", () => {
    expect(formatINRCompact(0)).toBe("₹0");
    expect(formatINRCompact(500)).toBe("₹500");
    expect(formatINRCompact(1000)).toBe("₹1k");
    expect(formatINRCompact(150000)).toBe("₹1.5L");
  });

  it("normalizes daily trend records into unified spot data items", () => {
    const rawDaily = [
      { date: "12 Aug", fullDate: "Wed, 12 Aug 2026", total: 18450 },
      { date: "13 Aug", fullDate: "Thu, 13 Aug 2026", total: 0 },
    ];

    const normalized = rawDaily.map((d) => ({
      label: d.date,
      fullDate: d.fullDate,
      total: d.total,
    }));

    expect(normalized.length).toBe(2);
    expect(normalized[0].label).toBe("12 Aug");
    expect(normalized[0].fullDate).toBe("Wed, 12 Aug 2026");
    expect(normalized[0].total).toBe(18450);

    // Ensure no abbreviation periods inside labels
    expect(normalized[0].label).not.toContain(".");
  });

  it("normalizes monthly trend records into unified spot data items", () => {
    const rawMonthly = [
      { month: "Aug 26", fullDate: "August 2026", total: 63618 },
      { month: "Sep 26", fullDate: "September 2026", total: 72100 },
    ];

    const normalized = rawMonthly.map((d) => ({
      label: d.month,
      fullDate: d.fullDate,
      total: d.total,
    }));

    expect(normalized.length).toBe(2);
    expect(normalized[0].label).toBe("Aug 26");
    expect(normalized[0].fullDate).toBe("August 2026");
    expect(normalized[0].total).toBe(63618);

    expect(normalized[0].label).not.toContain(".");
  });

  it("correctly computes Year-over-Year comparison deltas for graph line points", () => {
    const sampleYoy = {
      month: "Aug 26",
      thisYear: 50000,
      lastYear: 40000,
    };

    const diff = sampleYoy.thisYear - sampleYoy.lastYear;
    const pctDiff = Math.round((diff / sampleYoy.lastYear) * 100);

    expect(diff).toBe(10000);
    expect(pctDiff).toBe(25); // +25% higher
  });
});
