"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { createVendorAction, updateVendorAction, type VendorInput } from "@/lib/actions/vendors";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  pan: z.string().optional(),
  category: z.string().optional(),
  paymentTerms: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function VendorFormDialog({
  vendorId,
  defaultValues,
  trigger,
}: {
  vendorId?: string;
  defaultValues?: Partial<FormValues>;
  trigger?: "icon" | "button";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {},
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const input: VendorInput = { ...values, status: "ACTIVE" };
    const result = vendorId ? await updateVendorAction(vendorId, input) : await createVendorAction(input);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(vendorId ? "Vendor updated" : "Vendor added");
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
          <Button><Plus className="h-4 w-4" /> Add Vendor</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vendorId ? "Edit vendor" : "New vendor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="name">Company name *</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="contactPerson">Contact person</Label>
            <Input id="contactPerson" {...register("contactPerson")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <Input id="category" {...register("category")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gstNumber">GST number</Label>
            <Input id="gstNumber" {...register("gstNumber")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pan">PAN</Label>
            <Input id="pan" {...register("pan")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="paymentTerms">Payment terms</Label>
            <Input id="paymentTerms" placeholder="e.g. Net 30" {...register("paymentTerms")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
