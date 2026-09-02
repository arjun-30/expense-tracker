"use client";

import { useMemo, useState } from "react";
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
import { createPaymentAction } from "@/lib/actions/purchases";

const METHODS = ["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE", "CREDIT"];

const schema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  expenseId: z.string().optional(),
  amount: z.number().positive(),
  paymentDate: z.string().min(1),
  method: z.string().min(1, "Payment method is required"),
  referenceNumber: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// Invoicing was removed — payments link directly to an (optional) expense
// instead (see prisma/OPEN_DECISIONS.md #5).
interface ExpenseOption { id: string; expenseNumber: string; vendorId: string; totalAmount: number; paidAmount: number }

export function PaymentFormDialog({ vendors, expenses }: { vendors: { id: string; name: string }[]; expenses: ExpenseOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { paymentDate: new Date().toISOString().slice(0, 10) },
  });

  const vendorId = watch("vendorId");
  const expenseOptions = useMemo(
    () => expenses.filter((e) => e.vendorId === vendorId && e.paidAmount < e.totalAmount),
    [expenses, vendorId]
  );

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createPaymentAction({
      vendorId: values.vendorId,
      expenseId: values.expenseId || null,
      amount: values.amount,
      paymentDate: new Date(values.paymentDate),
      method: values.method as never,
      referenceNumber: values.referenceNumber || null,
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Payment recorded");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Record Payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
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
            <Label>Against expense</Label>
            <Controller
              control={control}
              name="expenseId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={!vendorId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {expenseOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.expenseNumber} (balance ₹{(e.totalAmount - e.paidAmount).toLocaleString("en-IN")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input id="amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="paymentDate">Payment date *</Label>
            <Input id="paymentDate" type="date" {...register("paymentDate")} />
          </div>
          <div className="space-y-1">
            <Label>Method *</Label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              )}
            />
            {errors.method && <p className="text-xs text-destructive">{errors.method.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="referenceNumber">Reference #</Label>
            <Input id="referenceNumber" {...register("referenceNumber")} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
