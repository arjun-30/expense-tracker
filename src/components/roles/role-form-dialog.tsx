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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createRoleAction, updateRoleAction, type RoleInput } from "@/lib/actions/roles";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function RoleFormDialog({
  roleId,
  isSystemRole,
  defaultValues,
  trigger,
}: {
  roleId?: string;
  isSystemRole?: boolean;
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
    const input: RoleInput = values;
    const result = roleId ? await updateRoleAction(roleId, input) : await createRoleAction(input);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(roleId ? "Role updated" : "Role created");
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
          <Button><Plus className="h-4 w-4" /> New Role</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{roleId ? "Edit role" : "New role"}</DialogTitle>
          {isSystemRole && (
            <DialogDescription>
              This is a system role — its name can&apos;t be changed, but the description can.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" disabled={isSystemRole} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
