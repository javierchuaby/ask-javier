import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip auth routes and static assets
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
  // We use 'cookieName' (v4 parameter) instead of 'salt'
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: "__Secure-authjs.session-token", 
  });

  // 3. Fallback: If not found, try the standard name (just in case)
  const finalToken = token || await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: "next-auth.session-token",
  });

  // 4. Debugging Log 
  console.log(`Middleware: Path: ${pathname}, Token found: ${!!finalToken}`);

  // 5. Protect all other routes
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