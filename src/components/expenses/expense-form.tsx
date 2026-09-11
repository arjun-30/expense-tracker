"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExpenseAction, updateExpenseAction, type ExpenseInput } from "@/lib/actions/expenses";
import { formatINR } from "@/lib/format";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  categoryId: z.string().min(1, "Category is required"),
  subcategoryId: z.string().optional(),
  amount: z.number().positive("Amount must be greater than zero"),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0),
  vendorId: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  costCenterId: z.string().optional(),
  paymentMethod: z.string().optional(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface RefData {
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; categoryId: string }[];
  departments: { id: string; name: string }[];
  costCenters: { id: string; name: string; departmentId: string | null }[];
  vendors: { id: string; name: string }[];
}

const PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE", "CREDIT"];

export function ExpenseForm({ refData, defaultValues, expenseId }: { refData: RefData; defaultValues?: Partial<FormValues>; expenseId?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      taxAmount: 0,
      discountAmount: 0,
      ...defaultValues,
    },
  });

  const parentCategories = refData.categories;
  const selectedParent = watch("categoryId");
  const subcategories = useMemo(
    () => refData.subcategories.filter((c) => c.categoryId === selectedParent),
    [refData.subcategories, selectedParent]
  );
  const amount = Number(watch("amount")) || 0;
  const tax = Number(watch("taxAmount")) || 0;
  const discount = Number(watch("discountAmount")) || 0;
  const total = amount + tax - discount;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);

    let result;
    if (expenseId) {
      const input: ExpenseInput = {
        ...values,
        date: new Date(values.date),
        subcategoryId: values.subcategoryId || null,
        vendorId: values.vendorId || null,
        costCenterId: values.costCenterId || null,
        paymentMethod: (values.paymentMethod as ExpenseInput["paymentMethod"]) || null,
        description: values.description || null,
        referenceNumber: values.referenceNumber || null,
      };
      result = await updateExpenseAction(expenseId, input);
    } else {
      const fd = new FormData();
      fd.set("date", values.date);
      fd.set("categoryId", values.categoryId);
      if (values.subcategoryId) fd.set("subcategoryId", values.subcategoryId);
      fd.set("amount", String(values.amount));
      fd.set("taxAmount", String(values.taxAmount));
      fd.set("discountAmount", String(values.discountAmount));
      if (values.vendorId) fd.set("vendorId", values.vendorId);
      fd.set("departmentId", values.departmentId);
      if (values.costCenterId) fd.set("costCenterId", values.costCenterId);
      if (values.paymentMethod) fd.set("paymentMethod", values.paymentMethod);
      if (values.description) fd.set("description", values.description);
      if (values.referenceNumber) fd.set("referenceNumber", values.referenceNumber);
      if (invoiceFile) fd.set("invoiceFile", invoiceFile);
      result = await createExpenseAction(fd);
    }

    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(expenseId ? "Expense updated" : "Expense created");
    router.push(`/expenses/${result.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Department *</Label>
            <Controller
              control={control}
              name="departmentId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {refData.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.departmentId && <p className="text-xs text-destructive">{errors.departmentId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {parentCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Subcategory</Label>
            <Controller
              control={control}
              name="subcategoryId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={subcategories.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                  <SelectContent>
                    {subcategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input id="amount" type="number" step="0.01" min="0" {...register("amount", { valueAsNumber: true })} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxAmount">Tax / GST (₹)</Label>
            <Input id="taxAmount" type="number" step="0.01" min="0" {...register("taxAmount", { valueAsNumber: true })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discountAmount">Discount (₹)</Label>
            <Input id="discountAmount" type="number" step="0.01" min="0" {...register("discountAmount", { valueAsNumber: true })} />
          </div>

          <div className="space-y-2">
            <Label>Total</Label>
            <p className="flex h-9 items-center font-heading text-lg font-semibold tabular-nums">{formatINR(total)}</p>
          </div>

          <div className="space-y-2">
            <Label>Vendor</Label>
            <Controller
              control={control}
              name="vendorId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {refData.vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Cost Center</Label>
            <Controller
              control={control}
              name="costCenterId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {refData.costCenters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Controller
              control={control}
              name="paymentMethod"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referenceNumber">Reference Number</Label>
            <Input id="referenceNumber" {...register("referenceNumber")} />
          </div>

          {!expenseId && (
            <div className="space-y-2 md:col-span-2">
              <Label>Invoice / Bill Upload</Label>
              <p className="text-xs text-muted-foreground">
                Optional — attaching an invoice now sends this expense straight for review. Without
                one, it goes to an admin for approval first.
              </p>
              <input
                ref={invoiceInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,.webp"
                className="hidden"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => invoiceInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> {invoiceFile ? "Change file" : "Attach invoice/bill"}
                </Button>
                {invoiceFile && <span className="text-sm text-muted-foreground">{invoiceFile.name}</span>}
              </div>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : expenseId ? "Save changes" : "Create Expense"}</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
