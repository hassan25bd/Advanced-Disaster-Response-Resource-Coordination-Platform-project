"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Navbar } from "./navbar";

const NAV: Record<string, { label: string; href: string }[]> = {
  SYSTEM_ADMIN: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Notifications", href: "/notifications" },
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
    { label: "Notifications", href: "/notifications" },
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
    { label: "Notifications", href: "/notifications" },
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
    { label: "Notifications", href: "/notifications" },
    { label: "Shelters", href: "/shelters" },
    { label: "Map", href: "/map" },
    { label: "Reports & Analytics", href: "/reports" },
    { label: "Profile", href: "/profile" },
  ],
  VOLUNTEER: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Notifications", href: "/notifications" },
    { label: "My Tasks", href: "/tasks" },
    { label: "Map", href: "/map" },
    { label: "Profile", href: "/profile" },
  ],
};

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as { role?: string } | undefined)?.role || "VOLUNTEER";
  const items = NAV[role] || NAV.VOLUNTEER;

  return (
    <aside className="shrink-0 border-b border-slate-200 bg-white md:w-64 md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="p-2 md:p-4">
        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto md:block md:space-y-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
  const pathname = usePathname();
  const { data: session } = useSession();
  if (pathname === "/login" || pathname === "/register") {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }
  const user = session?.user as { role?: string; organizationId?: string | null } | undefined;
  const needsOrganizationSetup = user?.role === "RELIEF_ORGANIZATION" && !user.organizationId;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <Navbar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          {needsOrganizationSetup && pathname !== "/organization/setup" && (
            <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <span>Complete your organization profile to access organization-scoped records.</span>
              <Link href="/organization/setup" className="font-semibold underline">Set up organization</Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
