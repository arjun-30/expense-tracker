"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAttachmentAction, deleteAttachmentAction } from "@/lib/actions/expenses";

interface Attachment {
  id: string;
  fileName: string;
  storageKey: string;
  fileSizeBytes: number | null;
  uploadedBy: { name: string };
  uploadedAt: string;
}

export function ExpenseAttachments({ expenseId, attachments, canEdit }: { expenseId: string; attachments: Attachment[]; canEdit: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const result = await uploadAttachmentAction(expenseId, formData);
      if (!result.success) {
        toast.error(result.error ?? "Upload failed");
        return;
      }
      toast.success("Attachment uploaded");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAttachmentAction(id);
      if (!result.success) {
        toast.error(result.error ?? "Delete failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {attachments.length === 0 && <p className="text-sm text-muted-foreground">No bills or invoices attached.</p>}
      <ul className="space-y-1">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <a href={`/api/files/${a.storageKey}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
              <FileText className="h-4 w-4 shrink-0" />
              <span>{a.fileName}</span>
              {a.fileSizeBytes !== null && <span className="text-xs text-muted-foreground">({(a.fileSizeBytes / 1024).toFixed(0)} KB)</span>}
            </a>
            {canEdit && (
              <Button variant="ghost" size="icon" disabled={pending} onClick={() => handleDelete(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload bill / invoice
          </Button>
        </>
      )}
    </div>
  );
}
