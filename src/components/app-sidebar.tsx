"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma/enums";
import { canAccessModuleClient } from "@/lib/rbac-client";

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Factory className="h-5 w-5" />
        <span className="text-sm font-semibold tracking-tight">Cost Control</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, idx) => {
          const items = section.items.filter((item) => canAccessModuleClient(role, item.key));
          if (items.length === 0) return null;
          return (
            <div key={idx}>
              {section.label && (
                <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
