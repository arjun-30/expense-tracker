"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, Building2, Landmark, Tag, Bell } from "lucide-react";

export function SettingsTabs({
  defaultTab,
  children,
}: {
  defaultTab: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const handleValueChange = (value: string) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <Tabs defaultValue={defaultTab} onValueChange={handleValueChange} className="space-y-4">
      <div className="w-full overflow-x-auto pb-1.5 flex justify-start sm:justify-end">
        <TabsList className="inline-flex w-max sm:min-w-0 h-auto p-1 gap-1">
          <TabsTrigger value="users" className="gap-2 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
            <Users className="h-4 w-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
            <Shield className="h-4 w-4" />
            <span>Roles</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
            <Building2 className="h-4 w-4" />
            <span>Departments</span>
          </TabsTrigger>
          <TabsTrigger value="cost-centers" className="gap-2 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
            <Landmark className="h-4 w-4" />
            <span>Cost Centers</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
            <Tag className="h-4 w-4" />
            <span>Categories</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
            <Bell className="h-4 w-4" />
            <span>Notification Rules</span>
          </TabsTrigger>
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
