import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// Whitelist of allowed email addresses
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

// Determine if we are in production
const isProduction = process.env.NODE_ENV === "production";

const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  trustHost: true,
  cookies: {
    sessionToken: {
      name: isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
        // Note: Cookies are domain-specific by design for security
        // Preview deployments (e.g., ask-javier-abc123.vercel.app) are separate domains
        // Users will need to sign in separately on each preview URL, which is expected behavior
        // The trustHost: true setting above handles dynamic host detection properly
      },
    },
  },
  callbacks: {
    async signIn({ user, account: _account, profile: _profile }) {
      // Check if user's email is in the whitelist
      if (user.email) {
        const emailLower = user.email.toLowerCase();
        const isAllowed = ALLOWED_EMAILS.includes(emailLower);

        if (!isAllowed) {
          return false; // Deny sign in
        }

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
