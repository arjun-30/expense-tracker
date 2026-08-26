import "server-only";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CountableDelegate = { count: (...args: any[]) => Promise<number> };

/**
 * Generates a human-readable sequential number like "EXP-000123". Uses a
 * count-and-retry strategy (cheap, no dedicated DB sequence) — collisions are
 * only possible under true concurrent writes to the same entity, so retry a
 * few times against the table's unique constraint rather than serializing
 * every create behind a lock.
 */
export async function nextSequenceNumber(
  delegate: CountableDelegate,
  prefix: string,
  padding = 6
): Promise<string> {
  const count = await delegate.count();
  return `${prefix}-${String(count + 1).padStart(padding, "0")}`;
}

export async function withSequenceRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isUniqueConflict =
        typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueConflict) throw err;
    }
  }
  throw lastError;
}

// re-export so callers don't need to import prisma just for typing
export type { CountableDelegate };
export { prisma };
