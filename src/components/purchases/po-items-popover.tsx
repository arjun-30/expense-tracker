"use client";

import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatINR, formatNumber } from "@/lib/format";

const ITEM_TYPE_LABELS: Record<string, string> = {
  SPARE_PARTS: "Spare Parts",
  CONSUMABLES: "Consumables",
};

export interface PoItemDetail {
  id: string;
  itemType: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  consumableName: string | null;
  consumableCategory: string | null;
}

/** Old-style items (pre PO redesign) carry a linked Consumable instead of an
 * itemType — derive a sensible category label from the consumable's own
 * category if it has one, falling back to "Spare Part" (these rows were all
 * created by the old Spare Parts feature before its removal). */
function typeLabel(item: PoItemDetail): string {
  if (item.itemType) return ITEM_TYPE_LABELS[item.itemType] ?? item.itemType;
  return item.consumableCategory || "Spare Part";
}

export function PoItemsPopover({ items }: { items: PoItemDetail[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-sm text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {items.length}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1.5">
          {items.map((item) => (
            <p key={item.id} className="text-xs leading-relaxed">
              <span className="font-medium">{typeLabel(item)}</span> — {item.consumableName ?? item.description} — Qty:{" "}
              {formatNumber(item.quantity)} — {formatINR(item.unitPrice)}
            </p>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground">No items.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
