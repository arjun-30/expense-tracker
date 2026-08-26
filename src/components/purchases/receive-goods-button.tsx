"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { receiveGoodsAction } from "@/lib/actions/purchases";

export function ReceiveGoodsButton({ purchaseOrderId }: { purchaseOrderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await receiveGoodsAction(purchaseOrderId);
          if (!result.success) {
            toast.error(result.error ?? "Failed to receive goods");
            return;
          }
          toast.success("Goods received — inventory updated");
          router.refresh();
        })
      }
    >
      <PackageCheck className="h-4 w-4" /> Receive
    </Button>
  );
}
