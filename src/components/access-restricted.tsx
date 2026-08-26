import { ShieldAlert } from "lucide-react";

export function AccessRestricted() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <ShieldAlert className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">Access restricted</p>
      <p className="text-sm text-muted-foreground">Your role does not have permission to view this module.</p>
    </div>
  );
}
