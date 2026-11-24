import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const { pathname } = req.nextUrl;

      if (pathname === "/login" || pathname === "/register") {
        return !token;
      }

      if (!token) return false;

      if (pathname.startsWith("/api")) return true;

      if (pathname === "/organization/setup") {
        return (token as any).role === "RELIEF_ORGANIZATION";
      }

      if (pathname.startsWith("/admin") || pathname.startsWith("/users")) {
        return (token as any).role === "SYSTEM_ADMIN";
      }

      if (pathname.startsWith("/coordinator") || pathname === "/allocations") {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes((token as any).role);
      }

      if (pathname.startsWith("/organization") || pathname.startsWith("/resources")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes((token as any).role);
      }

      if (pathname.startsWith("/shelters") || pathname.startsWith("/shelter")) {
        return [
          "SYSTEM_ADMIN",
          "EMERGENCY_COORDINATOR",
          "RELIEF_ORGANIZATION",
          "SHELTER_MANAGER",
        ].includes((token as any).role);
      }

      if (pathname.startsWith("/volunteers") || pathname.startsWith("/teams") || pathname.startsWith("/tasks")) {
        return [
          "SYSTEM_ADMIN",
          "EMERGENCY_COORDINATOR",
          "RELIEF_ORGANIZATION",
          "VOLUNTEER",
        ].includes((token as any).role);
      }

      return true;
    },
  },
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|register).*)",
  ],
};
