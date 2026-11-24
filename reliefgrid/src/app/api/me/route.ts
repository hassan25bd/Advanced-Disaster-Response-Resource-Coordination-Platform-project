import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });
    if (!full) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({
      id: full.id,
      name: full.name,
      email: full.email,
      role: full.role,
      organizationId: full.organizationId,
      organization: full.organization,
      phone: full.phone,
      availabilityStatus: full.availabilityStatus,
      isActive: full.isActive,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}
