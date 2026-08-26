import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageProvider {
  save(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile>;
  delete(key: string): Promise<void>;
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
 * Local-disk implementation used in dev/self-hosted deployments. Swap for an
 * S3/R2-backed StorageProvider in production by pointing STORAGE_DRIVER at a
 * new implementation of this same interface — nothing else in the app changes.
 */
class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor() {
    // Statically scoped to storage/uploads (not env-driven) so Turbopack doesn't
    // trace the whole project into the server output for a dynamic fs path.
    this.baseDir = path.join(process.cwd(), "storage", "uploads");
  }

  async save(buffer: Buffer, originalName: string, _mimeType: string): Promise<StoredFile> {
    const ext = safeExtension(originalName);
    const key = `${randomUUID()}${ext}`;
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(path.join(this.baseDir, key), buffer);
    return { key, url: `/api/files/${key}` };
  }

  async delete(key: string): Promise<void> {
    const safeKey = path.basename(key);
    await fs.rm(path.join(this.baseDir, safeKey), { force: true });
  }

  resolvePath(key: string): string {
    return path.join(this.baseDir, path.basename(key));
  }
}

let provider: LocalStorageProvider | null = null;

export function getStorageProvider(): LocalStorageProvider {
  if (!provider) provider = new LocalStorageProvider();
  return provider;
}
