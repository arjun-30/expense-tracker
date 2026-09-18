import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PiggyBank,
  Truck,
  Fuel,
  Route,
  Cog,
  Wrench,
  ShoppingCart,
  Building2,
  BarChart3,
  Users,
  Settings,
  ScrollText,
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
    label: "Finance",
    items: [
      { key: "expenses", label: "Expenses", href: "/expenses", icon: Receipt },
      { key: "payments", label: "Payments", href: "/payments", icon: Wallet },
      { key: "budgets", label: "Budgets", href: "/budgets", icon: PiggyBank },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "vehicles", label: "Vehicles", href: "/vehicles", icon: Truck },
      { key: "fuel", label: "Fuel", href: "/fuel", icon: Fuel },
      { key: "transportation", label: "Transportation", href: "/transportation", icon: Route },
      { key: "machinery", label: "Machinery", href: "/machinery", icon: Cog },
      { key: "maintenance", label: "Maintenance", href: "/maintenance", icon: Wrench },
    ],
  },
  {
    label: "Procurement",
    items: [
      { key: "purchases", label: "Purchases", href: "/purchases", icon: ShoppingCart },
      { key: "vendors", label: "Vendors", href: "/vendors", icon: Building2 },
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
      { key: "settings", label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
