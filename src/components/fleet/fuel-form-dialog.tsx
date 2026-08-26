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
import { createFuelTransactionAction } from "@/lib/actions/fleet";

const FUEL_TYPES = ["DIESEL", "PETROL", "CNG", "OTHER"];

const schema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().optional(),
  date: z.string().min(1),
  fuelType: z.string().min(1),
  fuelStation: z.string().optional(),
  litres: z.number().positive(),
  ratePerLitre: z.number().positive(),
  odometerReading: z.number().positive(),
});
type FormValues = z.infer<typeof schema>;

export function FuelFormDialog({ vehicles, drivers }: { vehicles: { id: string; registrationNumber: string; currentOdometer: number }[]; drivers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  });

  const vehicleId = watch("vehicleId");
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createFuelTransactionAction({
      ...values,
      driverId: values.driverId || null,
      fuelType: values.fuelType as never,
      fuelStation: values.fuelStation || null,
      date: new Date(values.date),
      paymentMethod: null,
      remarks: null,
    });
    setSubmitting(false);
    if (!result.success) { toast.error(result.error ?? "Something went wrong"); return; }
    toast.success("Fuel transaction recorded");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Record Fuel</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New fuel transaction</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Vehicle *</Label>
            <Controller control={control} name="vehicleId" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.registrationNumber}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {errors.vehicleId && <p className="text-xs text-destructive">{errors.vehicleId.message}</p>}
            {selectedVehicle && <p className="text-xs text-muted-foreground">Last odometer: {selectedVehicle.currentOdometer.toLocaleString("en-IN")} km</p>}
          </div>
          <div className="space-y-1">
            <Label>Driver</Label>
            <Controller control={control} name="driverId" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label>Fuel type *</Label>
            <Controller control={control} name="fuelType" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{FUEL_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date">Date *</Label>
            <Input id="date" type="date" {...register("date")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fuelStation">Fuel station</Label>
            <Input id="fuelStation" {...register("fuelStation")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="litres">Litres *</Label>
            <Input id="litres" type="number" step="0.01" {...register("litres", { valueAsNumber: true })} />
            {errors.litres && <p className="text-xs text-destructive">{errors.litres.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ratePerLitre">Rate / litre (₹) *</Label>
            <Input id="ratePerLitre" type="number" step="0.01" {...register("ratePerLitre", { valueAsNumber: true })} />
            {errors.ratePerLitre && <p className="text-xs text-destructive">{errors.ratePerLitre.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="odometerReading">Odometer reading (km) *</Label>
            <Input id="odometerReading" type="number" step="1" {...register("odometerReading", { valueAsNumber: true })} />
            {errors.odometerReading && <p className="text-xs text-destructive">{errors.odometerReading.message}</p>}
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save transaction"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
