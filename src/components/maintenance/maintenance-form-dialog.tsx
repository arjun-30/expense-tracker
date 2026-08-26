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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMaintenanceRecordAction } from "@/lib/actions/maintenance";

const MAINT_TYPES = ["PREVENTIVE", "CORRECTIVE", "BREAKDOWN", "EMERGENCY", "SCHEDULED_SERVICE"];

const schema = z.object({
  machineId: z.string().min(1, "Machine is required"),
  date: z.string().min(1),
  maintenanceType: z.string().min(1),
  problem: z.string().optional(),
  technician: z.string().optional(),
  labourCost: z.number().min(0),
  otherCost: z.number().min(0),
  downtimeMinutes: z.number().int().min(0).optional(),
  remarks: z.string().optional(),
  spares: z.array(z.object({ sparePartId: z.string().min(1), quantity: z.number().positive() })),
});
type FormValues = z.infer<typeof schema>;

export function MaintenanceFormDialog({ machines, spareParts }: { machines: { id: string; name: string }[]; spareParts: { id: string; name: string; currentStock: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().slice(0, 10), labourCost: 0, otherCost: 0, spares: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "spares" });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createMaintenanceRecordAction({
      ...values,
      maintenanceType: values.maintenanceType as never,
      problem: values.problem || null,
      technician: values.technician || null,
      downtimeMinutes: values.downtimeMinutes ?? null,
      remarks: values.remarks || null,
      date: new Date(values.date),
      diagnosis: null,
      nextMaintenanceDate: null,
    });
    setSubmitting(false);
    if (!result.success) { toast.error(result.error ?? "Something went wrong"); return; }
    toast.success("Maintenance record created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New Maintenance Record</Button></DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>New maintenance record</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Machine *</Label>
              <Controller control={control} name="machineId" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              )} />
              {errors.machineId && <p className="text-xs text-destructive">{errors.machineId.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Type *</Label>
              <Controller control={control} name="maintenanceType" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{MAINT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" type="date" {...register("date")} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="problem">Problem</Label>
              <Input id="problem" {...register("problem")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="technician">Technician</Label>
              <Input id="technician" {...register("technician")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="labourCost">Labour cost (₹)</Label>
              <Input id="labourCost" type="number" step="0.01" {...register("labourCost", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="otherCost">Other cost (₹)</Label>
              <Input id="otherCost" type="number" step="0.01" {...register("otherCost", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="downtimeMinutes">Downtime (min)</Label>
              <Input id="downtimeMinutes" type="number" step="1" {...register("downtimeMinutes", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Spare parts used</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-8">
                  <Controller control={control} name={`spares.${index}.sparePartId`} render={({ field: f }) => (
                    <Select onValueChange={f.onChange} value={f.value}>
                      <SelectTrigger><SelectValue placeholder="Spare part" /></SelectTrigger>
                      <SelectContent>
                        {spareParts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} (stock: {s.currentStock})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="col-span-3">
                  <Input type="number" step="1" min="1" placeholder="Qty" {...register(`spares.${index}.quantity`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ sparePartId: "", quantity: 1 })}>
              <Plus className="h-4 w-4" /> Add spare
            </Button>
          </div>

          <div className="space-y-1">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" rows={2} {...register("remarks")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save record"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
