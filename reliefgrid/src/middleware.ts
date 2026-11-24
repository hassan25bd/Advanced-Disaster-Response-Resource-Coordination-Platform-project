import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const { pathname } = req.nextUrl;

      if (pathname === "/login" || pathname === "/register") {
        return !token;
      }

      if (!token) return false;
      const role = typeof (token as { role?: unknown }).role === "string"
        ? (token as { role: string }).role
        : "";

      if (pathname.startsWith("/api")) return true;

      if (pathname === "/organization/setup") {
        return role === "RELIEF_ORGANIZATION";
      }

      if (pathname.startsWith("/organization")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(role);
      }
      if (pathname.startsWith("/coordinator")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(role);
      }
      if (pathname === "/shelter" || pathname.startsWith("/shelter/")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "SHELTER_MANAGER"].includes(role);
      }
      if (pathname.startsWith("/admin")) {
        return role === "SYSTEM_ADMIN";
      }

      if (pathname === "/users" || pathname === "/users/") {
        return role === "SYSTEM_ADMIN";
      }

      if (pathname.startsWith("/users/")) {
        return true;
      }

      if (pathname === "/incidents/create" || pathname.startsWith("/incidents/create/")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(role);
      }
      if (pathname === "/requests/create" || pathname.startsWith("/requests/create/")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(role);
      }
      if (pathname === "/allocations/create" || pathname.startsWith("/allocations/create/")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(role);
      }
      if (pathname === "/resources/create" || pathname.startsWith("/resources/create/")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(role);
      }
      if (pathname === "/shelters/create" || pathname.startsWith("/shelters/create/")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "SHELTER_MANAGER"].includes(role);
      }
      if (pathname === "/teams/create" || pathname.startsWith("/teams/create/")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(role);
      }
      if (pathname === "/tasks/create" || pathname.startsWith("/tasks/create/")) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(role);
      }
      if (/^\/incidents\/[^/]+\/edit$/.test(pathname)) {
        return ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(role);
      }

      if (pathname.startsWith("/allocations") ||
          pathname.startsWith("/resources") ||
          pathname.startsWith("/shelters") ||
          pathname.startsWith("/teams") ||
          pathname.startsWith("/tasks") ||
          pathname.startsWith("/volunteers")) {
        return true;
      }

      if (pathname.startsWith("/users")) {
        return role === "SYSTEM_ADMIN";
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
