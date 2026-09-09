"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPurchaseOrderAction } from "@/lib/actions/purchases";

const ITEM_TYPES = [
  { value: "SPARE_PARTS", label: "Spare Parts" },
  { value: "CONSUMABLES", label: "Consumables" },
] as const;

// Item Type is a plain category label chosen per row — not a link to any
// inventory record. Item Name is always manually entered, never looked up.
const itemSchema = z.object({
  itemType: z.string().min(1, "Required"),
  itemName: z.string().min(1, "Required"),
  quantity: z.number().positive(),
  amount: z.number().min(0),
});
const schema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  expectedDelivery: z.string().optional(),
  items: z.array(itemSchema).min(1),
});
type FormValues = z.infer<typeof schema>;

export function PurchaseOrderFormDialog({
  vendors,
}: {
  vendors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ itemType: "", itemName: "", quantity: 1, amount: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createPurchaseOrderAction({
      vendorId: values.vendorId,
      expectedDelivery: values.expectedDelivery ? new Date(values.expectedDelivery) : null,
      items: values.items.map((it) => ({
        itemType: it.itemType as never,
        description: it.itemName,
        quantity: it.quantity,
        unitPrice: it.amount,
        // The simplified item form has no GST input — these items are for
        // purchase-tracking/expense purposes only, not tax-itemized billing.
        gstPercent: 0,
      })),
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Purchase order created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New Purchase Order</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Vendor *</Label>
              <Controller
                control={control}
                name="vendorId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.vendorId && <p className="text-xs text-destructive">{errors.vendorId.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="expectedDelivery">Expected delivery</Label>
              <Input id="expectedDelivery" type="date" {...register("expectedDelivery")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Items *</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-3 space-y-1">
                  <Controller
                    control={control}
                    name={`items.${index}.itemType`}
                    render={({ field: f }) => (
                      <Select onValueChange={f.onChange} value={f.value}>
                        <SelectTrigger><SelectValue placeholder="Item type" /></SelectTrigger>
                        <SelectContent>
                          {ITEM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.items?.[index]?.itemType && (
                    <p className="text-xs text-destructive">{errors.items[index]?.itemType?.message}</p>
                  )}
                </div>
                <div className="col-span-4 space-y-1">
                  <Input placeholder="Item name" {...register(`items.${index}.itemName`)} />
                  {errors.items?.[index]?.itemName && (
                    <p className="text-xs text-destructive">{errors.items[index]?.itemName?.message}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <Input type="number" step="1" min="1" placeholder="Qty" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-2">
                  <Input type="number" step="0.01" min="0" placeholder="Amount" {...register(`items.${index}.amount`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ itemType: "", itemName: "", quantity: 1, amount: 0 })}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create purchase order"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
