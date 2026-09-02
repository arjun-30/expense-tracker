"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createDepartmentAction, createCostCenterAction, createCategoryAction, createSubcategoryAction, toggleNotificationRuleAction } from "@/lib/actions/settings";

export function QuickAddDepartment() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createDepartmentAction(name, code);
          if (!result.success) { toast.error(result.error ?? "Failed"); return; }
          setName(""); setCode(""); router.refresh();
        });
      }}
    >
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="h-8 w-28" />
      <Button type="submit" size="sm" disabled={pending}><Plus className="h-4 w-4" /></Button>
    </form>
  );
}

export function QuickAddCostCenter({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createCostCenterAction(name, code, departmentId ?? null);
          if (!result.success) { toast.error(result.error ?? "Failed"); return; }
          setName(""); setCode(""); router.refresh();
        });
      }}
    >
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="h-8 w-28" />
      <Select value={departmentId} onValueChange={setDepartmentId}>
        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Department" /></SelectTrigger>
        <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={pending}><Plus className="h-4 w-4" /></Button>
    </form>
  );
}

// Categories are always top-level now — nesting is at most 2 levels
// (category -> subcategory), see QuickAddSubcategory below.
export function QuickAddCategory() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createCategoryAction(name, code);
          if (!result.success) { toast.error(result.error ?? "Failed"); return; }
          setName(""); setCode(""); router.refresh();
        });
      }}
    >
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Input placeholder="Code (unique)" value={code} onChange={(e) => setCode(e.target.value)} className="h-8 w-36" />
      <Button type="submit" size="sm" disabled={pending}><Plus className="h-4 w-4" /></Button>
    </form>
  );
}

export function QuickAddSubcategory({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!categoryId) { toast.error("Choose a parent category"); return; }
        startTransition(async () => {
          const result = await createSubcategoryAction(name, code, categoryId);
          if (!result.success) { toast.error(result.error ?? "Failed"); return; }
          setName(""); setCode(""); router.refresh();
        });
      }}
    >
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Input placeholder="Code (unique per category)" value={code} onChange={(e) => setCode(e.target.value)} className="h-8 w-44" />
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Parent category" /></SelectTrigger>
        <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={pending}><Plus className="h-4 w-4" /></Button>
    </form>
  );
}

export function AlertRuleToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={isActive}
      disabled={pending}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          await toggleNotificationRuleAction(id, checked);
          router.refresh();
        })
      }
    />
  );
}
