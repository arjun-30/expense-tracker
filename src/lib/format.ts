const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrFormatterPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatINR(value: number, precise = false): string {
  return (precise ? inrFormatterPrecise : inrFormatter).format(value);
}

export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export function formatINRCompact(value: number): string {
  if (!value || isNaN(value)) return "₹0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 10000000) {
    const v = (abs / 10000000).toFixed(1).replace(/\.0$/, "");
    return `${sign}₹${v}Cr`;
  }
  if (abs >= 100000) {
    const v = (abs / 100000).toFixed(1).replace(/\.0$/, "");
    return `${sign}₹${v}L`;
  }
  if (abs >= 1000) {
    const v = (abs / 1000).toFixed(1).replace(/\.0$/, "");
    return `${sign}₹${v}k`;
  }
  return `${sign}₹${Math.round(abs)}`;
}
