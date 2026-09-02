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
import { createVehicleAction } from "@/lib/actions/fleet";

const schema = z.object({
  registrationNumber: z.string().min(1, "Required"),
  vehicleType: z.string().min(1, "Required"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  year: z.number().optional(),
  departmentId: z.string().optional(),
  currentOdometer: z.number().min(0),
  insuranceExpiry: z.string().optional(),
  pollutionExpiry: z.string().optional(),
  fitnessExpiry: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// Vehicles have no standing driver assignment any more — drivers are
// recorded per fuel transaction / trip instead (OPEN_DECISIONS.md #8).
export function VehicleFormDialog({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentOdometer: 0 },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createVehicleAction({
      ...values,
      manufacturer: values.manufacturer || null,
      model: values.model || null,
      year: values.year || null,
      departmentId: values.departmentId || null,
      insuranceExpiry: values.insuranceExpiry ? new Date(values.insuranceExpiry) : null,
      pollutionExpiry: values.pollutionExpiry ? new Date(values.pollutionExpiry) : null,
      fitnessExpiry: values.fitnessExpiry ? new Date(values.fitnessExpiry) : null,
    });
    setSubmitting(false);
    if (!result.success) { toast.error(result.error ?? "Something went wrong"); return; }
    toast.success("Vehicle added");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add Vehicle</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New vehicle</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="registrationNumber">Registration # *</Label>
            <Input id="registrationNumber" {...register("registrationNumber")} />
            {errors.registrationNumber && <p className="text-xs text-destructive">{errors.registrationNumber.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicleType">Type *</Label>
            <Input id="vehicleType" placeholder="Truck, Van…" {...register("vehicleType")} />
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
            <Label htmlFor="currentOdometer">Current odometer (km)</Label>
            <Input id="currentOdometer" type="number" {...register("currentOdometer", { valueAsNumber: true })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Department</Label>
            <Controller control={control} name="departmentId" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="insuranceExpiry">Insurance expiry</Label>
            <Input id="insuranceExpiry" type="date" {...register("insuranceExpiry")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pollutionExpiry">Pollution cert. expiry</Label>
            <Input id="pollutionExpiry" type="date" {...register("pollutionExpiry")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fitnessExpiry">Fitness cert. expiry</Label>
            <Input id="fitnessExpiry" type="date" {...register("fitnessExpiry")} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save vehicle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
