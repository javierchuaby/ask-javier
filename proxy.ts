import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";

// Determine cookie name based on environment (matches NextAuth config)
const isProduction = env.NODE_ENV === "production";
const cookieName = isProduction
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth routes and static assets
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Check for token using the configured cookie name
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET,
    cookieName: cookieName,
  });

  // Protect all other routes
  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
