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
import { createInvoiceAction } from "@/lib/actions/purchases";

const schema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  purchaseOrderId: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  amount: z.number().positive(),
  taxAmount: z.number().min(0),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function InvoiceFormDialog({ vendors, purchaseOrders }: { vendors: { id: string; name: string }[]; purchaseOrders: { id: string; poNumber: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { taxAmount: 0, invoiceDate: new Date().toISOString().slice(0, 10) },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createInvoiceAction({
      vendorId: values.vendorId,
      purchaseOrderId: values.purchaseOrderId || null,
      invoiceNumber: values.invoiceNumber,
      amount: values.amount,
      taxAmount: values.taxAmount,
      invoiceDate: new Date(values.invoiceDate),
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Invoice recorded");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="h-4 w-4" /> Record Invoice</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record vendor invoice</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Vendor *</Label>
            <Controller
              control={control}
              name="vendorId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            />
            {errors.vendorId && <p className="text-xs text-destructive">{errors.vendorId.message}</p>}
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Purchase order</Label>
            <Controller
              control={control}
              name="purchaseOrderId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{purchaseOrders.map((p) => <SelectItem key={p.id} value={p.id}>{p.poNumber}</SelectItem>)}</SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoiceNumber">Invoice number *</Label>
            <Input id="invoiceNumber" {...register("invoiceNumber")} />
            {errors.invoiceNumber && <p className="text-xs text-destructive">{errors.invoiceNumber.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoiceDate">Invoice date *</Label>
            <Input id="invoiceDate" type="date" {...register("invoiceDate")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input id="amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="taxAmount">Tax (₹)</Label>
            <Input id="taxAmount" type="number" step="0.01" {...register("taxAmount", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" type="date" {...register("dueDate")} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save invoice"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
