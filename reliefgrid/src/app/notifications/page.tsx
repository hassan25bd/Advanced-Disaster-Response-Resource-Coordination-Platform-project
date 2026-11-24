"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

type NotificationItem = {
  id: string; title: string; message: string; type: string;
  isRead: boolean; link: string | null; createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await apiFetch("/api/notifications?page=1&pageSize=100");
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch("/api/notifications?page=1&pageSize=100").then((result) => {
      if (!active) return;
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
      setError("");
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load notifications.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function markRead(notification: NotificationItem) {
    try {
      await apiFetch(`/api/notifications/${encodeURIComponent(notification.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isRead: true }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update notification.");
    }
  }

  if (loading) return <p className="py-10 text-center">Loading notifications...</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm text-slate-500">{unreadCount} unread</p></div><Button onClick={() => void load()}>Refresh</Button></div>
      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!notifications.length ? <Card><CardContent className="py-8 text-center text-slate-500">You are all caught up.</CardContent></Card> : notifications.map((notification) => (
        <Card key={notification.id} className={notification.isRead ? "opacity-75" : "border-rose-200"}>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div><CardTitle className="text-lg">{notification.title}</CardTitle><p className="mt-1 text-xs text-slate-500">{notification.type.replaceAll("_", " ")} · {new Date(notification.createdAt).toLocaleString()}</p></div>
            {!notification.isRead && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">New</span>}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-700">{notification.message}</p>
            <div className="flex gap-4 text-sm">
              {notification.link && <Link className="font-medium text-rose-700 hover:underline" href={notification.link}>Open related record</Link>}
              {!notification.isRead && <button className="font-medium text-slate-600 hover:underline" onClick={() => void markRead(notification)}>Mark as read</button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
