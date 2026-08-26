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
import { createBudgetAction } from "@/lib/actions/budgets";

const PERIODS = ["MONTHLY", "QUARTERLY", "YEARLY"];

const schema = z.object({
  name: z.string().min(1, "Required"),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  period: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  amount: z.number().positive(),
});
type FormValues = z.infer<typeof schema>;

export function BudgetFormDialog({ departments, categories }: { departments: { id: string; name: string }[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { period: "MONTHLY" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await createBudgetAction({
      ...values,
      departmentId: values.departmentId || null,
      categoryId: values.categoryId || null,
      costCenterId: null,
      period: values.period as never,
      periodStart: new Date(values.periodStart),
      periodEnd: new Date(values.periodEnd),
    });
    setSubmitting(false);
    if (!result.success) { toast.error(result.error ?? "Something went wrong"); return; }
    toast.success("Budget created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New Budget</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New budget</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="name">Budget name *</Label>
            <Input id="name" placeholder="e.g. Maintenance Budget — Q1" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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
            <Label>Category</Label>
            <Controller control={control} name="categoryId" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label>Period *</Label>
            <Controller control={control} name="period" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input id="amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="periodStart">Period start *</Label>
            <Input id="periodStart" type="date" {...register("periodStart")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="periodEnd">Period end *</Label>
            <Input id="periodEnd" type="date" {...register("periodEnd")} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save budget"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
