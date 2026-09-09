"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMachineAction, updateMachineAction } from "@/lib/actions/maintenance";

const MACHINE_STATUSES = ["RUNNING", "IDLE", "UNDER_MAINTENANCE", "BREAKDOWN", "RETIRED"] as const;

const schema = z.object({
  machineCode: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  location: z.string().optional(),
  departmentId: z.string().optional(),
  purchaseCost: z.number().min(0).optional(),
  status: z.enum(MACHINE_STATUSES),
});
type FormValues = z.infer<typeof schema>;

export function MachineFormDialog({
  machineId,
  departments,
  defaultValues,
  trigger,
}: {
  machineId?: string;
  departments: { id: string; name: string }[];
  defaultValues?: Partial<FormValues>;
  trigger?: "icon" | "button";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // New machines always default to RUNNING and don't expose a status field
    // in create mode (unchanged create behavior); editing an existing
    // machine always pre-fills its actual current status via defaultValues.
    defaultValues: { status: "RUNNING", ...defaultValues },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const input = {
      ...values,
      manufacturer: values.manufacturer || null,
      model: values.model || null,
      location: values.location || null,
      departmentId: values.departmentId || null,
      purchaseCost: values.purchaseCost ?? null,
    };
    const result = machineId ? await updateMachineAction(machineId, input) : await createMachineAction(input);
    setSubmitting(false);
    if (!result.success) { toast.error(result.error ?? "Something went wrong"); return; }
    toast.success(machineId ? "Machine updated" : "Machine added");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "icon" ? (
          <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button><Plus className="h-4 w-4" /> Add Machine</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{machineId ? "Edit machine" : "New machine"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="machineCode">Machine code *</Label>
            <Input id="machineCode" {...register("machineCode")} />
            {errors.machineCode && <p className="text-xs text-destructive">{errors.machineCode.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...register("location")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input id="manufacturer" {...register("manufacturer")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="model">Model</Label>
            <Input id="model" {...register("model")} />
          </div>
          <div className="space-y-1">
            <Label>Department</Label>
            <Controller control={control} name="departmentId" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchaseCost">Purchase price (₹)</Label>
            <Input id="purchaseCost" type="number" step="0.01" {...register("purchaseCost", { valueAsNumber: true })} />
          </div>
          {machineId && (
            <div className="space-y-1">
              <Label>Status</Label>
              <Controller control={control} name="status" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MACHINE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          )}
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save machine"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
