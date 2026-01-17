import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow access to auth routes and public assets
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // 2. FORCE check for the cookie name seen in your screenshot
  // We check specifically for the Auth.js v5 name
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    salt: "__Secure-authjs.session-token", // Explicitly look for the v5 secure cookie
  });
  
  // 3. Fallback: If not found, try the non-secure version (just in case)
  // This helps if you switch between dev/prod often
  const fallbackToken = token || await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    salt: "authjs.session-token",
  });

  const finalToken = token || fallbackToken;

  console.log(`Middleware: Path: ${pathname}, Token found: ${!!finalToken}`);

  // 4. Protect all other routes
  if (!finalToken) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
