import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await requireRole("RELIEF_ORGANIZATION");
    if (user.organizationId) {
      return NextResponse.json({ error: "Your account is already linked to an organization" }, { status: 409 });
    }

    const body = await req.json();
    const { name, registrationNo, type, contactEmail, address } = body || {};
    if (typeof name !== "string" || name.trim().length < 2 ||
        typeof registrationNo !== "string" || registrationNo.trim().length < 2) {
      return NextResponse.json({ error: "Organization name and registration number are required" }, { status: 400 });
    }
    const resolvedContactEmail = typeof contactEmail === "string" && contactEmail.trim()
      ? contactEmail.trim()
      : user.email;
    if (!resolvedContactEmail.includes("@")) {
      return NextResponse.json({ error: "A valid organization contact email is required" }, { status: 400 });
    }

    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: name.trim(),
          type: typeof type === "string" && type.trim() ? type.trim() : "Relief Organization",
          registrationNo: registrationNo.trim(),
          contactEmail: resolvedContactEmail,
          address: typeof address === "string" ? address.trim() : "",
        },
      });
      const linked = await tx.user.updateMany({
        where: { id: user.id, organizationId: null },
        data: { organizationId: created.id },
      });
      if (linked.count !== 1) {
        throw Object.assign(new Error("This account is already linked to an organization"), { status: 409 });
      }
      return created;
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That organization registration number is already in use" }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "status" in error &&
        typeof error.status === "number" && error.status >= 400 && error.status < 500) {
      const message = "message" in error && typeof error.message === "string"
        ? error.message
        : "Unable to set up organization";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to set up organization" }, { status: 500 });
  }
}
