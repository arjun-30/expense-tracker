"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { canAccessModuleClient } from "@/lib/rbac-client";

export function AppSidebar({ roles }: { roles: string[] }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Factory className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-sm font-semibold tracking-tight text-white">Cost Control</p>
          <p className="truncate text-[11px] text-sidebar-foreground/60">Expense Management</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, idx) => {
          const items = section.items.filter((item) => canAccessModuleClient(roles, item.key));
          if (items.length === 0) return null;
          return (
            <div key={idx}>
              {section.label && (
                <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
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
                          "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        {active && (
                          <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                        )}
                        <Icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
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
