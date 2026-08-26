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
import { createDepartmentAction, createCostCenterAction, createCategoryAction, toggleAlertRuleAction } from "@/lib/actions/settings";

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

export function QuickAddCategory({ parents }: { parents: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createCategoryAction(name, code, parentId ?? null);
          if (!result.success) { toast.error(result.error ?? "Failed"); return; }
          setName(""); setCode(""); router.refresh();
        });
      }}
    >
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Input placeholder="Code (unique)" value={code} onChange={(e) => setCode(e.target.value)} className="h-8 w-36" />
      <Select value={parentId} onValueChange={setParentId}>
        <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Top-level category" /></SelectTrigger>
        <SelectContent>{parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
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
          await toggleAlertRuleAction(id, checked);
          router.refresh();
        })
      }
    />
  );
}
