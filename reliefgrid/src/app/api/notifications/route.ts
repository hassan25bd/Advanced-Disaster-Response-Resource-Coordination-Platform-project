import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get("pageSize") || "20", 10), 1), 100);
    const where = { userId: user.id };
    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);
    return NextResponse.json({ data, total, unreadCount, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}
