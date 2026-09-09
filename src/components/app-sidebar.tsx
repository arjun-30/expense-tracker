"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory, ChevronDown } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { canAccessModuleClient, getPanelLabel } from "@/lib/rbac-client";

/** Shared row styling/active-state logic for both top-level nav items and
 * nested children — kept as one function so the two render sites (below)
 * can't drift out of sync with each other. */
function navLinkClasses(active: boolean) {
  return cn(
    "relative flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-200",
    active
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "text-sidebar-foreground outline-none hover:bg-sidebar-hover hover:text-white focus-visible:bg-sidebar-hover focus-visible:text-white focus-visible:ring-3 focus-visible:ring-sidebar-ring/50"
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  // Only Settings has children today, but this generalizes to any item —
  // starts expanded (no existing item's visibility should regress behind
  // an extra click just because it moved under a parent).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Factory className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">Expense Management</p>
          <p className="truncate text-[11px] text-sidebar-foreground">Cost Control</p>
          <p className="truncate text-[10px] text-sidebar-heading">{getPanelLabel(roles)}</p>
        </div>
      </div>
      <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, idx) => {
          const items = section.items.filter((item) => canAccessModuleClient(roles, item.key));
          if (items.length === 0) return null;
          return (
            <div key={idx}>
              {section.label && (
                <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-heading">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  const children = item.children?.filter((c) => canAccessModuleClient(roles, c.key)) ?? [];
                  const hasChildren = children.length > 0;
                  const expanded = !collapsedGroups.has(item.key);

                  return (
                    <li key={item.key}>
                      <div className="relative flex items-center gap-0.5">
                        <Link href={item.href} className={navLinkClasses(active)}>
                          {active && (
                            <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                          )}
                          <Icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
                          {item.label}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                            aria-expanded={expanded}
                            onClick={() =>
                              setCollapsedGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.key)) next.delete(item.key);
                                else next.add(item.key);
                                return next;
                              })
                            }
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground outline-none hover:bg-sidebar-hover hover:text-white focus-visible:bg-sidebar-hover focus-visible:text-white focus-visible:ring-3 focus-visible:ring-sidebar-ring/50"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", !expanded && "-rotate-90")} />
                          </button>
                        )}
                      </div>
                      {hasChildren && expanded && (
                        <ul className="mt-0.5 ml-3.5 space-y-0.5 border-l border-sidebar-border pl-2.5">
                          {children.map((child) => {
                            const childActive = isActive(pathname, child.href);
                            const ChildIcon = child.icon;
                            return (
                              <li key={child.key}>
                                <Link href={child.href} className={navLinkClasses(childActive)}>
                                  {childActive && (
                                    <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                                  )}
                                  <ChildIcon className={cn("h-4 w-4 shrink-0", childActive && "text-sidebar-primary")} />
                                  {child.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
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
