"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";

const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: "System Admin",
  EMERGENCY_COORDINATOR: "Emergency Coordinator",
  RELIEF_ORGANIZATION: "Relief Organization",
  VOLUNTEER: "Volunteer",
  SHELTER_MANAGER: "Shelter Manager",
};

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const user = (session?.user as any) || {};
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsUnavailable, setNotificationsUnavailable] = useState(false);

  useEffect(() => {
    if (!user.id) return;
    let active = true;
    const refresh = () => {
      apiFetch("/api/notifications?page=1&pageSize=1")
        .then((result) => {
          if (!active) return;
          setUnreadCount(result.unreadCount);
          setNotificationsUnavailable(false);
        })
        .catch(() => { if (active) setNotificationsUnavailable(true); });
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user.id]);

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="h-8 w-8 rounded bg-rose-600 flex items-center justify-center text-white font-bold">RG</span>
            <span className="font-bold text-xl text-slate-900 tracking-tight">ReliefGrid</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Operational
            </span>
          </div>
          <Link href="/notifications" aria-label="Notifications" className="relative text-sm font-medium text-slate-600 hover:text-rose-700">
            Notifications{notificationsUnavailable ? <span className="ml-1 text-amber-700" title="Notification count unavailable">!</span> : unreadCount > 0 && <span className="ml-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-xs text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </Link>
          <div className="ml-4 flex items-center gap-3 rtl:space-x-reverse">
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">{user.name || "User"}</p>
                <p className="text-xs text-slate-500 capitalize">{ROLE_LABEL[user.role] || user.role}</p>
                {user.organization && (
                  <p className="text-xs text-slate-400">{user.organization.name}</p>
                )}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-slate-400 hover:text-rose-600"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
