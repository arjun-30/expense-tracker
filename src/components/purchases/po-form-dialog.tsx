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

const itemSchema = z.object({
  sparePartId: z.string().optional(),
  description: z.string().min(1, "Required"),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  gstPercent: z.number().min(0),
});
const schema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  expectedDelivery: z.string().optional(),
  items: z.array(itemSchema).min(1),
});
type FormValues = z.infer<typeof schema>;

export function PurchaseOrderFormDialog({
  vendors,
  spareParts,
}: {
  vendors: { id: string; name: string }[];
  spareParts: { id: string; name: string; purchasePrice: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ description: "", quantity: 1, unitPrice: 0, gstPercent: 18 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createPurchaseOrderAction({
      vendorId: values.vendorId,
      expectedDelivery: values.expectedDelivery ? new Date(values.expectedDelivery) : null,
      items: values.items.map((it) => ({ ...it, sparePartId: it.sparePartId || null })),
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
              <div key={field.id} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-4 space-y-1">
                  <Controller
                    control={control}
                    name={`items.${index}.sparePartId`}
                    render={({ field: f }) => (
                      <Select
                        onValueChange={(v) => {
                          f.onChange(v);
                          const spare = spareParts.find((s) => s.id === v);
                          if (spare) {
                            setValue(`items.${index}.description`, spare.name);
                            setValue(`items.${index}.unitPrice`, spare.purchasePrice);
                          }
                        }}
                        value={f.value}
                      >
                        <SelectTrigger><SelectValue placeholder="Spare (optional)" /></SelectTrigger>
                        <SelectContent>
                          {spareParts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-3">
                  <Input placeholder="Description" {...register(`items.${index}.description`)} />
                </div>
                <div className="col-span-2">
                  <Input type="number" step="1" min="1" placeholder="Qty" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-2">
                  <Input type="number" step="0.01" min="0" placeholder="Unit price" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0, gstPercent: 18 })}>
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
