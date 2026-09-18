"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Truck, BarChart3, Layers } from "lucide-react";

export function DashboardTabs({
  defaultTab,
  title,
  description,
  children,
}: {
  defaultTab: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const handleValueChange = (value: string) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (value === "overview") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", value);
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <Tabs defaultValue={defaultTab} onValueChange={handleValueChange} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/70 pb-4 mb-2">
        <div className="min-w-0">
          {title && (
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
          )}
          {description && (
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="overflow-x-auto shrink-0 pb-0.5 sm:pb-0">
          <TabsList className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted/70 p-1 border border-border/60 shadow-2xs">
            <TabsTrigger
              value="overview"
              className="group relative inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-150 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:font-semibold select-none cursor-pointer"
            >
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0 transition-colors group-data-[state=active]:text-primary" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger
              value="operations"
              className="group relative inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-150 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:font-semibold select-none cursor-pointer"
            >
              <Truck className="h-3.5 w-3.5 shrink-0 transition-colors group-data-[state=active]:text-primary" />
              <span>Vehicles & Machinery</span>
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="group relative inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-150 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:font-semibold select-none cursor-pointer"
            >
              <BarChart3 className="h-3.5 w-3.5 shrink-0 transition-colors group-data-[state=active]:text-primary" />
              <span>Spend Analysis</span>
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="group relative inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-150 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:font-semibold select-none cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 shrink-0 transition-colors group-data-[state=active]:text-primary" />
              <span>All Metrics</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      {children}
    </Tabs>
  );
}
