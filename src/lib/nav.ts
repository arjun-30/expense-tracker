import {
  LayoutDashboard,
  Receipt,
  Building2,
  Users,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Core",
    items: [
      { key: "expenses", label: "Expenses", href: "/expenses", icon: Receipt },
      { key: "vendors", label: "Vendors", href: "/vendors", icon: Building2 },
    ],
  },
  {
    label: "Administration",
    items: [
      { key: "usersRoles", label: "Users", href: "/users", icon: Users },
      { key: "roles", label: "Roles", href: "/roles", icon: ShieldCheck },
      { key: "settings", label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
