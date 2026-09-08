"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Returns to wherever the viewer actually came from — a filtered
 * /expenses?status=X list, /dashboard?status=X, etc. — via real browser
 * history (router.back() is equivalent to the native back action, not a
 * separate navigation stack entry), rather than a hardcoded destination
 * that would ignore where the user actually navigated from. */
export function BackButton() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.back()}>
      <ChevronLeft className="h-4 w-4" /> Back
    </Button>
  );
}
