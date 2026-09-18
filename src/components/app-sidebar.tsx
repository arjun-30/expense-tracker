"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, User, LogOut } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { canAccessModuleClient, getPanelLabel } from "@/lib/rbac-client";
import { ROLE_LABELS } from "@/lib/role-labels";
import { logoutAction } from "@/lib/actions/auth";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export interface SessionUserInfo {
  name: string;
  email: string;
}

function navLinkClasses(active: boolean) {
  return cn(
    "relative flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-200",
    active
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "text-sidebar-foreground outline-none hover:bg-sidebar-hover hover:text-white focus-visible:bg-sidebar-hover focus-visible:text-white focus-visible:ring-3 focus-visible:ring-sidebar-ring/50"
  );
}

function isItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return href !== "/" && pathname.startsWith(href + "/");
}

function SidebarNav({
  roles,
  onNavigate,
}: {
  roles: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  return (
    <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, idx) => {
        const items = section.items.filter((item) =>
          item.children
            ? item.children.some((c) => canAccessModuleClient(roles, c.key))
            : canAccessModuleClient(roles, item.key)
        );
        if (items.length === 0) return null;

        return (
          <div key={section.label ?? idx} className="space-y-1">
            {section.label && (
              <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-heading">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isItemActive(pathname, item.href);
                const Icon = item.icon;
                const children = item.children?.filter((c) => canAccessModuleClient(roles, c.key)) ?? [];
                const hasChildren = children.length > 0;
                const expanded = !collapsedGroups.has(item.key);

                return (
                  <li key={item.key}>
                    {hasChildren ? (
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
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                            !expanded && "-rotate-90"
                          )}
                        />
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={navLinkClasses(active)}
                      >
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
                          const childActive = isItemActive(pathname, child.href);
                          const ChildIcon = child.icon;
                          return (
                            <li key={`${item.key}-${child.key}`}>
                              <Link
                                href={child.href}
                                onClick={onNavigate}
                                className={navLinkClasses(childActive)}
                              >
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
  );
}

function SidebarUserFooter({
  user,
  roles,
  onNavigate,
}: {
  user?: SessionUserInfo;
  roles: string[];
  onNavigate?: () => void;
}) {
  const primaryRole = roles[0] ? (ROLE_LABELS[roles[0] as keyof typeof ROLE_LABELS] ?? roles[0]) : "";

  return (
    <div className="border-t border-sidebar-border bg-zinc-800/80 px-3.5 py-3 transition-colors hover:bg-zinc-800/95">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/profile"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2.5 group"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 border border-zinc-600/70 font-semibold text-xs text-zinc-100 uppercase group-hover:border-zinc-500 transition-colors">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1 leading-tight text-left">
            <p className="truncate text-xs font-medium text-white group-hover:text-blue-300 transition-colors">
              {user?.name ?? "User Account"}
            </p>
            <p className="truncate text-[11px] font-medium text-blue-400 mt-0.5">
              {primaryRole || "Super Admin"}
            </p>
          </div>
        </Link>

        <form action={logoutAction} className="shrink-0">
          <button
            type="submit"
            title="Log out"
            aria-label="Log out"
            className="flex h-7 w-7 items-center justify-center rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Log out</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export function SidebarContent({
  roles,
  user,
  onNavigate,
}: {
  roles: string[];
  user?: SessionUserInfo;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> used with mix-blend-screen */}
        <img src="/logo.png" alt="" className="h-9 w-9 shrink-0 object-contain mix-blend-screen" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-[13px] font-semibold tracking-tight text-sidebar-foreground">
            Expense Management
          </p>
          <p className="truncate text-xs font-medium text-blue-400 mt-0.5">
            {getPanelLabel(roles)}
          </p>
        </div>
      </div>
      <Suspense fallback={<nav className="flex-1 px-3 py-4" />}>
        <SidebarNav roles={roles} onNavigate={onNavigate} />
      </Suspense>
      <SidebarUserFooter user={user} roles={roles} onNavigate={onNavigate} />
    </div>
  );
}

export function AppSidebar({
  roles,
  user,
}: {
  roles: string[];
  user?: SessionUserInfo;
}) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <SidebarContent roles={roles} user={user} />
    </aside>
  );
}

export function MobileNavHeader({
  roles,
  user,
}: {
  roles: string[];
  user?: SessionUserInfo;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer whenever user navigates
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground md:hidden z-40">
      <div className="flex items-center gap-2.5">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-hover hover:text-white"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 border-r border-sidebar-border p-0 bg-sidebar text-sidebar-foreground focus:outline-none"
            showCloseButton={false}
          >
            <div className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
              <SheetDescription>Access application modules and settings</SheetDescription>
            </div>
            <SidebarContent roles={roles} user={user} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/dashboard" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> used with mix-blend-screen */}
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 object-contain mix-blend-screen" />
          <span className="font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">
            Expense Management
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent font-medium text-xs text-sidebar-accent-foreground uppercase transition-colors hover:ring-2 hover:ring-sidebar-ring"
          title="Account Profile"
        >
          {user?.name ? user.name.slice(0, 2) : <User className="h-4 w-4" />}
        </Link>
      </div>
    </header>
  );
}
