import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// Whitelist of allowed email addresses
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Check if user's email is in the whitelist
      if (user.email) {
        const emailLower = user.email.toLowerCase();
        const isAllowed = ALLOWED_EMAILS.includes(emailLower);

        if (!isAllowed) {
          console.log(`Access denied for email: ${user.email}`);
          return false; // Deny sign in
        }

        console.log(`Access granted for email: ${user.email}`);
        return true; // Allow sign in
      }

      return false; // Deny if no email
    },
    async session({ session, token }) {
      // Add user ID to session if needed
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
  secret: process.env.NEXTAUTH_SECRET,
};

const { handlers } = NextAuth(authOptions);

export const { GET, POST } = handlers;
