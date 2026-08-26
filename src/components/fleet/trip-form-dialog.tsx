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
import { createTransportTripAction } from "@/lib/actions/fleet";

const schema = z.object({
  date: z.string().min(1),
  vehicleId: z.string().min(1, "Vehicle is required"),
  transporterId: z.string().optional(),
  driverId: z.string().optional(),
  source: z.string().min(1, "Required"),
  destination: z.string().min(1, "Required"),
  material: z.string().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  numberOfTrips: z.number().int().positive(),
  freight: z.number().min(0),
  loadingCost: z.number().min(0),
  unloadingCost: z.number().min(0),
  toll: z.number().min(0),
  parking: z.number().min(0),
  otherCharges: z.number().min(0),
});
type FormValues = z.infer<typeof schema>;

export function TripFormDialog({ vehicles, drivers, transporters }: { vehicles: { id: string; registrationNumber: string }[]; drivers: { id: string; name: string }[]; transporters: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      numberOfTrips: 1, freight: 0, loadingCost: 0, unloadingCost: 0, toll: 0, parking: 0, otherCharges: 0,
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createTransportTripAction({
      ...values,
      transporterId: values.transporterId || null,
      driverId: values.driverId || null,
      material: values.material || null,
      quantity: values.quantity ?? null,
      unit: values.unit || null,
      date: new Date(values.date),
    });
    setSubmitting(false);
    if (!result.success) { toast.error(result.error ?? "Something went wrong"); return; }
    toast.success("Trip recorded");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Record Trip</Button></DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>New transport trip</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="date">Date *</Label>
            <Input id="date" type="date" {...register("date")} />
          </div>
          <div className="space-y-1">
            <Label>Vehicle *</Label>
            <Controller control={control} name="vehicleId" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.registrationNumber}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {errors.vehicleId && <p className="text-xs text-destructive">{errors.vehicleId.message}</p>}
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
            <Label htmlFor="source">Source *</Label>
            <Input id="source" {...register("source")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="destination">Destination *</Label>
            <Input id="destination" {...register("destination")} />
          </div>
          <div className="space-y-1">
            <Label>Transporter</Label>
            <Controller control={control} name="transporterId" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{transporters.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="material">Material</Label>
            <Input id="material" {...register("material")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="quantity">Quantity</Label>
            <Input id="quantity" type="number" step="0.01" {...register("quantity", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" placeholder="kg, tonne…" {...register("unit")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="freight">Freight (₹)</Label>
            <Input id="freight" type="number" step="0.01" {...register("freight", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="loadingCost">Loading (₹)</Label>
            <Input id="loadingCost" type="number" step="0.01" {...register("loadingCost", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="unloadingCost">Unloading (₹)</Label>
            <Input id="unloadingCost" type="number" step="0.01" {...register("unloadingCost", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="toll">Toll (₹)</Label>
            <Input id="toll" type="number" step="0.01" {...register("toll", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="parking">Parking (₹)</Label>
            <Input id="parking" type="number" step="0.01" {...register("parking", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="otherCharges">Other (₹)</Label>
            <Input id="otherCharges" type="number" step="0.01" {...register("otherCharges", { valueAsNumber: true })} />
          </div>
          <DialogFooter className="col-span-3">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save trip"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
