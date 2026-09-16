import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { env } from "@/lib/env";

const ALLOWED_EMAILS = env.ALLOWED_EMAILS.split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

export const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  trustHost: true,

  callbacks: {
    async signIn({ user, account: _account, profile: _profile }) {
      if (user.email) {
        const emailLower = user.email.toLowerCase();
        
        // If ALLOWED_EMAILS is not set, allow all (optional, but let's stick to their existing logic)
        const isAllowed = ALLOWED_EMAILS.length === 0 ? true : ALLOWED_EMAILS.includes(emailLower);

        if (!isAllowed) {
          return false;
        }

        return true;
      }

      return false;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
