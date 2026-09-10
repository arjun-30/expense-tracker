"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_STATUS_LABELS } from "@/lib/status-labels";

// APPROVED is a legacy status with no active workflow — see page.tsx's
// original comment. Excluded from the filter dropdown only.
const FILTERABLE_STATUS_ENTRIES = Object.entries(EXPENSE_STATUS_LABELS).filter(([value]) => value !== "APPROVED");

const SEARCH_DEBOUNCE_MS = 400;

/** Auto-applying replacement for the old manual-submit <form method="get">:
 * Status/Department changes update the URL immediately; search text
 * debounces so rapid typing doesn't fire a request per keystroke. Every
 * change merges into the CURRENT searchParams (read fresh via
 * useSearchParams() each time) rather than replacing the whole query
 * string, so combined filters (status + department + search) keep
 * working exactly as before — this only changes how a filter value
 * reaches the URL, not the server-side reading/validation logic in
 * page.tsx (parseFilterParam, VALID_EXPENSE_STATUSES), which is
 * untouched. Changing any filter resets pagination (drops ?page=) since
 * page 2 of a differently-filtered result set rarely makes sense. */
export function ExpenseFilters({
  admin,
  departments,
  initialQuery,
  initialStatus,
  initialDepartment,
}: {
  admin: boolean;
  departments: { id: string; name: string }[];
  initialQuery: string;
  initialStatus: string;
  initialDepartment: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync if the URL changes from outside this component
  // (browser back/forward, a bookmarked link).
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const applyParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      // "all" is the Select's own "no filter" sentinel — omit the param
      // entirely rather than round-tripping the literal string, matching
      // parseFilterParam's existing "all" = undefined semantics server-side.
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  function onQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyParam("q", value.trim()), SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search expense #, description…"
        value={query}
        onChange={onQueryChange}
        className="w-64"
      />
      <Select value={initialStatus} onValueChange={(v) => applyParam("status", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {FILTERABLE_STATUS_ENTRIES.map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {admin && (
        <Select value={initialDepartment} onValueChange={(v) => applyParam("department", v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
