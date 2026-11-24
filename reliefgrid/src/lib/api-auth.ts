import { unstable_getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function getServerSession() {
  return unstable_getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getServerSession();
  const sessionUser = session?.user as { id?: string } | undefined;
  const user = sessionUser?.id ? await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, role: true, organizationId: true, isActive: true },
  }) : null;
  if (!user?.isActive) {
    const error = new Error("Unauthorized") as Error & { status?: number };
    error.status = 401;
    throw error;
  }
  return user;
}

export async function requireRole(...allowed: string[]) {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) {
    const error = new Error("Forbidden") as Error & { status?: number };
    error.status = 403;
    throw error;
  }
  return user;
}
