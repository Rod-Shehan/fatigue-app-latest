import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isEmailAllowedForAlphaAccess, isAlphaAllowlistEnabled } from "@/lib/auth-alpha-allowlist";

const PROTECTED_PREFIXES = [
  "/driver",
  "/sheets",
  "/manager",
  "/messages",
  "/drivers",
  "/admin",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (!isAlphaAllowlistEnabled() || !isProtectedPath(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (pathname === "/access-restricted") {
    return applySecurityHeaders(NextResponse.next());
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const email = typeof token?.email === "string" ? token.email : null;
  if (token?.sub && email && !isEmailAllowedForAlphaAccess(email)) {
    if (pathname.startsWith("/api/")) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Access restricted for this pilot." }, { status: 403 })
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/access-restricted";
    url.search = "";
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/driver/:path*",
    "/sheets/:path*",
    "/manager/:path*",
    "/messages/:path*",
    "/drivers/:path*",
    "/admin/:path*",
    "/access-restricted",
    "/api/:path*",
  ],
};
