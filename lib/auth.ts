import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcrypt-ts";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret:
    process.env.NEXTAUTH_SECRET ??
    // Dev fallback only. For production set NEXTAUTH_SECRET.
    "dev-only-change-me",
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        kode: { label: "Kode", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.kode || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { kode: credentials.kode as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          kode: user.kode,
          name: user.name || "",
          email: user.email || "",
          role: user.role || "USER",
        } as any;
      },
    }),
  ],
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
