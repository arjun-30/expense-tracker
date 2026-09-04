import { z } from "zod";

// Pure schema/mapping, split out from src/lib/actions/vendors.ts (a "use
// server" file, which Next.js only allows async function exports from — this
// couldn't live there and still be unit-testable).
export const vendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type VendorInput = z.infer<typeof vendorSchema>;

/** This mapping (status -> isActive) is the crux of the "editing silently
 * reactivates a deactivated vendor" bug: it must always derive isActive from
 * the submitted status, never default/override it. */
export function toVendorData(data: z.infer<typeof vendorSchema>) {
  const { status, ...rest } = data;
  return { ...rest, isActive: status === "ACTIVE" };
}
