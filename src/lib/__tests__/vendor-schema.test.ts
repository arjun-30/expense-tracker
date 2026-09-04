import { describe, it, expect } from "vitest";
import { vendorSchema, toVendorData } from "@/lib/vendor-schema";

const BASE_FIELDS = {
  name: "Acme Supplies",
  contactPerson: null,
  phone: null,
  email: null,
  address: null,
  gstNumber: null,
  pan: null,
  category: null,
  paymentTerms: null,
};

describe("toVendorData: status -> isActive mapping (repeat-reactivation bug fix)", () => {
  it("maps status ACTIVE to isActive: true", () => {
    const result = toVendorData({ ...BASE_FIELDS, status: "ACTIVE" });
    expect(result.isActive).toBe(true);
  });

  it("maps status INACTIVE to isActive: false", () => {
    const result = toVendorData({ ...BASE_FIELDS, status: "INACTIVE" });
    expect(result.isActive).toBe(false);
  });

  it("never carries a 'status' key into the DB write payload (schema field is isActive)", () => {
    const result = toVendorData({ ...BASE_FIELDS, status: "ACTIVE" });
    expect(result).not.toHaveProperty("status");
  });

  it("editing an already-INACTIVE vendor's other fields, with status still INACTIVE in the payload, keeps it INACTIVE", () => {
    // This is the exact repro: before the fix, the form hardcoded status:
    // "ACTIVE" on every submit regardless of the vendor's real current
    // status, so any edit to an inactive vendor silently reactivated it.
    const editedPhoneOnly = { ...BASE_FIELDS, phone: "9999999999", status: "INACTIVE" as const };
    const result = toVendorData(editedPhoneOnly);
    expect(result.isActive).toBe(false);
    expect(result.phone).toBe("9999999999");
  });
});

describe("vendorSchema", () => {
  it("accepts an explicit status of ACTIVE or INACTIVE", () => {
    expect(vendorSchema.safeParse({ ...BASE_FIELDS, status: "ACTIVE" }).success).toBe(true);
    expect(vendorSchema.safeParse({ ...BASE_FIELDS, status: "INACTIVE" }).success).toBe(true);
  });

  it("rejects an invalid status value", () => {
    expect(vendorSchema.safeParse({ ...BASE_FIELDS, status: "DELETED" }).success).toBe(false);
  });

  it("defaults status to ACTIVE only when the field is entirely absent (a caller safety net, not the form's behavior)", () => {
    const { status, ...withoutStatus } = { ...BASE_FIELDS, status: "ACTIVE" as const };
    void status;
    const parsed = vendorSchema.safeParse(withoutStatus);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.status).toBe("ACTIVE");
  });
});
