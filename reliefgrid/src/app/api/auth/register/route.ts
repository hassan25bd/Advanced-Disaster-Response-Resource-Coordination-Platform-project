import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, role, organizationName, registrationNo } = body || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!email || !String(email).includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    if (!["VOLUNTEER", "RELIEF_ORGANIZATION"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (role === "RELIEF_ORGANIZATION" &&
        (typeof organizationName !== "string" || organizationName.trim().length < 2 ||
         typeof registrationNo !== "string" || registrationNo.trim().length < 2)) {
      return NextResponse.json({ error: "Organization name and registration number are required" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail.startsWith("rgdemo-") && normalizedEmail.endsWith("@example.invalid")) {
      return NextResponse.json({ error: "This email prefix is reserved for shared demo records" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const organization = role === "RELIEF_ORGANIZATION"
        ? await tx.organization.create({
          data: {
            name: organizationName.trim(),
            type: "Relief Organization",
            registrationNo: registrationNo.trim(),
            contactEmail: normalizedEmail,
            address: "",
          },
        })
        : null;

      return tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role,
          isActive: true,
          ...(organization ? { organizationId: organization.id } : {}),
        },
        select: { id: true, name: true, email: true, role: true, organizationId: true },
      });
    });

    return NextResponse.json({ user });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Email or organization registration number already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
