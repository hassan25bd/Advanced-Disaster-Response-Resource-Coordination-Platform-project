import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireRole("SYSTEM_ADMIN");
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    return NextResponse.json(org);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireRole("SYSTEM_ADMIN");
    const body = await req.json();
    const { name, type, registrationNo, contactEmail, address, verified } = body || {};

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (registrationNo !== undefined) data.registrationNo = registrationNo;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (address !== undefined) data.address = address;
    if (verified !== undefined) data.verified = verified;

    const org = await prisma.organization.update({ where: { id }, data });
    return NextResponse.json(org);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireRole("SYSTEM_ADMIN");
    const demoProfile = await prisma.user.findFirst({
      where: {
        organizationId: id,
        email: { startsWith: "rgdemo-", endsWith: "@example.invalid" },
      },
      select: { id: true },
    });
    if (demoProfile) {
      return NextResponse.json({ error: "Organizations with shared demo records cannot be deleted" }, { status: 409 });
    }
    await prisma.organization.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}
