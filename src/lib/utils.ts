import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * List/filter pages use the sentinel value "all" for a Select's "All ..."
 * option (since Radix Select doesn't allow an empty-string item value).
 * Treat "all", empty, and missing values the same way: as "no filter" —
 * so callers omit the key entirely from a Prisma `where` clause instead of
 * passing the literal string "all" through to it.
 */
export function parseFilterParam(value: string | undefined): string | undefined {
  return value && value !== "all" ? value : undefined;
}
