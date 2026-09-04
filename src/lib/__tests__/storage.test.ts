import { describe, it, expect } from "vitest";
import { resourceTypeFor } from "@/lib/storage";

describe("resourceTypeFor: decides Cloudinary's resource_type per file", () => {
  it("uploads images as 'image'", () => {
    expect(resourceTypeFor("image/png")).toBe("image");
    expect(resourceTypeFor("image/jpeg")).toBe("image");
    expect(resourceTypeFor("image/webp")).toBe("image");
  });

  it("uploads PDFs as 'raw' — not 'image', which 401s on accounts without the PDF/ZIP delivery setting enabled", () => {
    expect(resourceTypeFor("application/pdf")).toBe("raw");
  });

  it("falls back to 'raw' for missing/unknown mime types rather than assuming 'image'", () => {
    expect(resourceTypeFor(undefined)).toBe("raw");
    expect(resourceTypeFor(null)).toBe("raw");
    expect(resourceTypeFor("application/octet-stream")).toBe("raw");
  });
});
