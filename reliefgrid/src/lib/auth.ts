import bcrypt from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import { NextAuthOptions } from "next-auth";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { organization: true },
        });
        if (!user || !user.isActive) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          organization: user.organization ? { id: user.organization.id, name: user.organization.name } : null,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as any;
        token.id = u.id;
        token.role = u.role;
        token.organizationId = u.organizationId;
        token.organization = u.organization;
      }
      if (trigger === "update" && typeof token.id === "string") {
        const account = await prisma.user.findUnique({
          where: { id: token.id },
          include: { organization: true },
        });
        if (account) {
          token.organizationId = account.organizationId;
          token.organization = account.organization
            ? { id: account.organization.id, name: account.organization.name }
            : null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any;
        u.id = token.id;
        u.role = token.role;
        u.organizationId = token.organizationId;
        u.organization = token.organization;
      }
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.AUTH_SECRET,
};
