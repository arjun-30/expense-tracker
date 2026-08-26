"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSparePartAction } from "@/lib/actions/maintenance";

const schema = z.object({
  partNumber: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  category: z.string().optional(),
  supplierId: z.string().optional(),
  unit: z.string().min(1),
  purchasePrice: z.number().min(0),
  currentStock: z.number().min(0),
  minimumStock: z.number().min(0),
  storageLocation: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function SparePartFormDialog({ vendors }: { vendors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { unit: "pcs", purchasePrice: 0, currentStock: 0, minimumStock: 0 },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createSparePartAction({
      ...values,
      category: values.category || null,
      supplierId: values.supplierId || null,
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
            <Label>Supplier</Label>
            <Controller control={control} name="supplierId" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" {...register("unit")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchasePrice">Unit price (₹)</Label>
            <Input id="purchasePrice" type="number" step="0.01" {...register("purchasePrice", { valueAsNumber: true })} />
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
