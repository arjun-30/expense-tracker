"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createConsumableAction } from "@/lib/actions/maintenance";

const schema = z.object({
  partNumber: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  category: z.string().optional(),
  unit: z.string().min(1),
  unitCost: z.number().min(0),
  currentStock: z.number().min(0),
  minimumStock: z.number().min(0),
  storageLocation: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// Consumables have no default-supplier field any more — supplier is only
// ever recorded per purchase order (see prisma/SCHEMA_MIGRATION_NOTES.md §3).
export function SparePartFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { unit: "pcs", unitCost: 0, currentStock: 0, minimumStock: 0 },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createConsumableAction({
      ...values,
      category: values.category || null,
      storageLocation: values.storageLocation || null,
      maximumStock: null,
    });
    setSubmitting(false);
    if (!result.success) { toast.error(result.error ?? "Something went wrong"); return; }
    toast.success("Spare part added");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add Spare Part</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New spare part</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="partNumber">Part number *</Label>
            <Input id="partNumber" {...register("partNumber")} />
            {errors.partNumber && <p className="text-xs text-destructive">{errors.partNumber.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <Input id="category" {...register("category")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" {...register("unit")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="unitCost">Unit price (₹)</Label>
            <Input id="unitCost" type="number" step="0.01" {...register("unitCost", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="currentStock">Opening stock</Label>
            <Input id="currentStock" type="number" step="1" {...register("currentStock", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="minimumStock">Minimum stock</Label>
            <Input id="minimumStock" type="number" step="1" {...register("minimumStock", { valueAsNumber: true })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="storageLocation">Storage location</Label>
            <Input id="storageLocation" {...register("storageLocation")} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save spare part"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
