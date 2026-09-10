"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
  // Groups start collapsed by default -- listing a key here means that
  // group's children are hidden until the user expands it. Only "settings"
  // needs this today; a future group would default to expanded (not in
  // this Set) unless its key is added here too, matching the same "list
  // what's collapsed" convention rather than inverting the logic globally.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(["settings"]));

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- this app
         * doesn't use next/image anywhere else; a plain <img> matches its
         * existing convention. mix-blend-screen makes the logo's own
         * near-black square background disappear against --sidebar (screen-
         * blending black contributes nothing, so the background shows
         * through unchanged) while its white glyph still renders at full
         * white regardless of what's behind it — the source file has a
         * solid black background, not a transparent one, so without this
         * it would show as a visible black square. */}
        <img src="/logo.png" alt="" className="h-10 w-10 shrink-0 object-contain mix-blend-screen" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-[13px] font-semibold tracking-tight text-sidebar-foreground">Expense Management</p>
          <p className="truncate text-[10px] text-sidebar-heading">{getPanelLabel(roles)}</p>
        </div>
      </div>
      <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, idx) => {
          // A parent with children is visible if ANY child is accessible to
          // this user, not by the parent's own key — otherwise a group whose
          // own route (e.g. /settings) is admin-only would hide its entire
          // dropdown, including children like Profile that everyone can
          // reach, just because the parent item's key maps to a narrower
          // role set than one of its children.
          const items = section.items.filter((item) =>
            item.children
              ? item.children.some((c) => canAccessModuleClient(roles, c.key))
              : canAccessModuleClient(roles, item.key)
          );
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
                      {hasChildren ? (
                        // Pure toggle -- the whole row (icon + label +
                        // chevron) expands/collapses the children. No href,
                        // no navigation: only the children themselves link
                        // anywhere.
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                          onClick={() =>
                            setCollapsedGroups((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.key)) next.delete(item.key);
                              else next.add(item.key);
                              return next;
                            })
                          }
                          className={navLinkClasses(active)}
                        >
                          {active && (
                            <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                          )}
                          <Icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", !expanded && "-rotate-90")} />
                        </button>
                      ) : (
                        <Link href={item.href} className={navLinkClasses(active)}>
                          {active && (
                            <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                          )}
                          <Icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
                          {item.label}
                        </Link>
                      )}
                      {hasChildren && expanded && (
                        <ul className="mt-0.5 ml-3.5 space-y-0.5 border-l border-sidebar-border pl-2.5">
                          {children.map((child) => {
                            const childActive = isActive(pathname, child.href);
                            const ChildIcon = child.icon;
                            return (
                              // Namespaced by parent key: a child's own key
                              // (used for its canAccessModuleClient lookup,
                              // e.g. "settings" for Organization Settings)
                              // can legitimately equal the parent item's key
                              // when they intentionally share a destination
                              // -- React keys only need to be unique among
                              // siblings, but disambiguating here removes
                              // any identity ambiguity regardless.
                              <li key={`${item.key}-${child.key}`}>
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
