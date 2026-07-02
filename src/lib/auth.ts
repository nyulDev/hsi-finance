import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "../lib/prisma";
import * as bcrypt from "bcrypt-ts";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma) as any,

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
          where: {
            kode: credentials.kode as string,
          },
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
          name: user.name,
          role: user.role,
        } as any;
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 86400, // 24 hours
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      // Add role, name, and kode to token when user signs in
      if (user) {
        token.role = user.role;
        token.name = user.name;
        token.kode = user.kode;
      }
      return token;
    },
    async session({ session, token }) {
      // Add role, name, and kode to session
      if (token) {
        (session.user as any).role = token.role;
        (session.user as any).name = token.name;
        (session.user as any).kode = token.kode;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Redirect USER role to investor dashboard after login
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
});
