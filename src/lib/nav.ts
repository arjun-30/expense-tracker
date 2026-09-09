import {
  LayoutDashboard,
  Receipt,
  Fuel,
  Truck,
  Route,
  Cog,
  Wrench,
  ShoppingCart,
  Building2,
  Wallet,
  PiggyBank,
  BarChart3,
  Bell,
  ScrollText,
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
  /** Sub-items nested under this one (e.g. Settings -> Users & Roles, Roles).
   * One level deep only — no nav item here currently needs more than that. */
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
      { key: "notifications", label: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Expenses",
    items: [
      { key: "expenses", label: "Expenses", href: "/expenses", icon: Receipt },
      { key: "budgets", label: "Budgets", href: "/budgets", icon: PiggyBank },
    ],
  },
  {
    label: "Fleet",
    items: [
      { key: "fuel", label: "Fuel", href: "/fuel", icon: Fuel },
      { key: "vehicles", label: "Vehicles", href: "/vehicles", icon: Truck },
      { key: "transportation", label: "Transportation", href: "/transportation", icon: Route },
    ],
  },
  {
    label: "Assets",
    items: [
      { key: "machinery", label: "Machinery", href: "/machinery", icon: Cog },
      { key: "maintenance", label: "Maintenance", href: "/maintenance", icon: Wrench },
    ],
  },
  {
    label: "Procurement",
    items: [
      { key: "purchases", label: "Purchases", href: "/purchases", icon: ShoppingCart },
      { key: "vendors", label: "Vendors", href: "/vendors", icon: Building2 },
      { key: "payments", label: "Payments", href: "/payments", icon: Wallet },
    ],
  },
  {
    label: "Insights",
    items: [
      { key: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
      { key: "auditLogs", label: "Audit Logs", href: "/audit-logs", icon: ScrollText },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        key: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
        children: [
          { key: "usersRoles", label: "Users & Roles", href: "/users", icon: Users },
          { key: "roles", label: "Roles", href: "/roles", icon: ShieldCheck },
        ],
      },
    ],
  },
];
