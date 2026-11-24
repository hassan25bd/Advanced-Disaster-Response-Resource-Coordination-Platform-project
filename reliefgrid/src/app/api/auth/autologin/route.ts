import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: "admin@reliefgrid.org" },
      include: { organization: true },
    });
    if (!user) return NextResponse.json({ error: "Admin user not found" }, { status: 404 });

    const token = await encode({
      secret: process.env.AUTH_SECRET!,
      token: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization ? { id: user.organization.id, name: user.organization.name } : null,
      },
      maxAge: 60 * 60 * 24 * 30,
    });

    const cookieStore = await cookies();
    cookieStore.set("next-auth.session-token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Auto login failed" }, { status: 500 });
  }
}
