import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportExportButtons({ type, query }: { type: string; query: Record<string, string | undefined> }) {
  const params = new URLSearchParams();
  params.set("type", type);
  for (const [k, v] of Object.entries(query)) {
    if (v) params.set(k, v);
  }

  function hrefFor(format: string) {
    const p = new URLSearchParams(params);
    p.set("format", format);
    return `/api/reports/export?${p.toString()}`;
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" asChild><a href={hrefFor("csv")}><Download className="h-4 w-4" /> CSV</a></Button>
      <Button variant="outline" size="sm" asChild><a href={hrefFor("xlsx")}><Download className="h-4 w-4" /> Excel</a></Button>
      <Button variant="outline" size="sm" asChild><a href={hrefFor("pdf")}><Download className="h-4 w-4" /> PDF</a></Button>
    </div>
  );
}
