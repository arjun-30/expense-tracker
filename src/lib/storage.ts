import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageProvider {
  save(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile>;
  /** `mimeType` lets a provider that needs it (e.g. Cloudinary's resource_type)
   * locate the file; providers that don't need it may ignore the param. */
  read(key: string, mimeType?: string | null): Promise<Buffer>;
  delete(key: string, mimeType?: string | null): Promise<void>;
}

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".pdf", ".webp"]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

function safeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type: ${ext || "unknown"}`);
  }
  return ext;
}

/**
 * Cloudinary's "image" resource type delivers through its image pipeline
 * (transformations, previews) but new accounts have PDF/ZIP delivery through
 * it disabled by default (the "Allow delivery of PDF and ZIP files" security
 * setting) — fetching one 401s until an admin flips that toggle. Uploading
 * non-image files as "raw" instead delivers the exact bytes with no such
 * account-level dependency, at the cost of no image-style transformations
 * (irrelevant here — we only ever serve the original file).
 */
export function resourceTypeFor(mimeType?: string | null): "image" | "raw" {
  return mimeType?.startsWith("image/") ? "image" : "raw";
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Cloudinary-backed implementation — local disk doesn't survive a request in
 * Vercel's serverless environment, so files must land in external storage on
 * first write. `key` (== Cloudinary's public_id) is what's persisted as
 * ExpenseAttachment.storageKey; the delivery URL is reconstructed from it on
 * read rather than stored separately, since it's fully determined by
 * (public_id, resource_type) and resource_type is already recoverable from
 * the attachment's own `fileType` column — no extra field needed.
 */
class CloudinaryStorageProvider implements StorageProvider {
  async save(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    safeExtension(originalName);
    const resourceType = resourceTypeFor(mimeType);
    const publicId = `mecs_${randomUUID()}`;

    const result = await new Promise<{ public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: resourceType, overwrite: false },
        (error, uploadResult) => {
          if (error || !uploadResult) return reject(error ?? new Error("Cloudinary upload failed"));
          resolve(uploadResult);
        }
      );
      stream.end(buffer);
    });

    return { key: result.public_id, url: `/api/files/${result.public_id}` };
  }

  async read(key: string, mimeType?: string | null): Promise<Buffer> {
    const url = cloudinary.url(key, { resource_type: resourceTypeFor(mimeType), secure: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not retrieve file from storage (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string, mimeType?: string | null): Promise<void> {
    // invalidate: true best-efforts a CDN cache purge (Cloudinary notes full
    // propagation can take up to an hour) — moot for this app in practice,
    // since every access goes through /api/files/[key], which checks the
    // ExpenseAttachment row first; that row is gone the moment this resolves,
    // so a stale CDN copy of the raw Cloudinary URL (never exposed to
    // clients) can't be reached through the app regardless.
    await cloudinary.uploader.destroy(key, { resource_type: resourceTypeFor(mimeType), invalidate: true });
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) provider = new CloudinaryStorageProvider();
  return provider;
}
