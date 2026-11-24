import { unstable_getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function getServerSession() {
  return unstable_getServerSession(authOptions);
}

export async function requireAuth(): Promise<any> {
  const session = await getServerSession();
  if (!session?.user) {
    const error = new Error("Unauthorized") as Error & { status?: number };
    error.status = 401;
    throw error;
  }
  return session.user;
}

export async function requireRole(...allowed: string[]): Promise<any> {
  const user = await requireAuth();
  if (!allowed.includes((user as any).role)) {
    const error = new Error("Forbidden") as Error & { status?: number };
    error.status = 403;
    throw error;
  }
  return user;
}
