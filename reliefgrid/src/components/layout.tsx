"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Navbar } from "./navbar";

const NAV: Record<string, { label: string; href: string }[]> = {
  SYSTEM_ADMIN: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Incidents", href: "/incidents" },
    { label: "Emergency Requests", href: "/requests" },
    { label: "Resources", href: "/resources" },
    { label: "Resource Allocation", href: "/allocations" },
    { label: "Shelters", href: "/shelters" },
    { label: "Volunteers", href: "/volunteers" },
    { label: "Teams", href: "/teams" },
    { label: "Map", href: "/map" },
    { label: "Reports & Analytics", href: "/reports" },
    { label: "User Management", href: "/users" },
    { label: "Profile", href: "/profile" },
  ],
  EMERGENCY_COORDINATOR: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Incidents", href: "/incidents" },
    { label: "Emergency Requests", href: "/requests" },
    { label: "Resources", href: "/resources" },
    { label: "Resource Allocation", href: "/allocations" },
    { label: "Shelters", href: "/shelters" },
    { label: "Volunteers", href: "/volunteers" },
    { label: "Teams", href: "/teams" },
    { label: "Map", href: "/map" },
    { label: "Reports & Analytics", href: "/reports" },
    { label: "Profile", href: "/profile" },
  ],
  RELIEF_ORGANIZATION: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Incidents", href: "/incidents" },
    { label: "Emergency Requests", href: "/requests" },
    { label: "Resources", href: "/resources" },
    { label: "Resource Allocation", href: "/allocations" },
    { label: "Shelters", href: "/shelters" },
    { label: "Teams", href: "/teams" },
    { label: "Map", href: "/map" },
    { label: "Reports & Analytics", href: "/reports" },
    { label: "Profile", href: "/profile" },
  ],
  SHELTER_MANAGER: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Shelters", href: "/shelters" },
    { label: "Map", href: "/map" },
    { label: "Reports & Analytics", href: "/reports" },
    { label: "Profile", href: "/profile" },
  ],
  VOLUNTEER: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "My Tasks", href: "/tasks" },
    { label: "Map", href: "/map" },
    { label: "Profile", href: "/profile" },
  ],
};

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as any)?.role || "VOLUNTEER";
  const items = NAV[role] || NAV.VOLUNTEER;

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 border-r border-slate-200 bg-white">
      <div className="p-4">
        <nav className="space-y-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-rose-50 text-rose-700" : "text-slate-600 hover:bg-slate-50"
              }`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
