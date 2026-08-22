import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isEmailAllowedForAlphaAccess, isAlphaAllowlistEnabled } from "@/lib/auth-alpha-allowlist";
import {
  getAppSurface,
  isPathAllowedOnSurface,
  redirectForBlockedPath,
} from "@/lib/app-surface";
import {
  CIRCADIA_DESK_HOST,
  CIRCADIA_DESK_PATH,
  hostnameFromHostHeader,
  isLegacyCircadiaDeskHostname,
  MARKETING_SITE_URL,
} from "@/lib/circadia-desk";

const PROTECTED_PREFIXES = [
  "/driver",
  "/sheets",
  "/manager",
  "/messages",
  "/drivers",
  "/admin",
  "/circadia",
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
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const surface = getAppSurface(host);

  if (pathname.startsWith("/api/auth")) {
    return applySecurityHeaders(NextResponse.next());
  }

  const hostname = hostnameFromHostHeader(host);
  if (isLegacyCircadiaDeskHostname(hostname)) {
    const dest = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CIRCADIA_DESK_HOST}`);
    return applySecurityHeaders(NextResponse.redirect(dest, 308));
  }

  if (surface === "circadia") {
    // Staff door is the host itself. /circadia is the desk; / is rewritten, not sent to www.
    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = CIRCADIA_DESK_PATH;
      return applySecurityHeaders(NextResponse.rewrite(url));
    }
    const onDesk =
      pathname === CIRCADIA_DESK_PATH || pathname.startsWith(`${CIRCADIA_DESK_PATH}/`);
    if (!onDesk && !pathname.startsWith("/api/")) {
      return applySecurityHeaders(NextResponse.redirect(MARKETING_SITE_URL));
    }
  }

  // Soft product split: send wrong-audience pages to sibling host or lobby.
  if (!pathname.startsWith("/api/") && !isPathAllowedOnSurface(pathname, surface)) {
    const target = redirectForBlockedPath(pathname, surface);
    if (target.external) {
      return applySecurityHeaders(NextResponse.redirect(target.location));
    }
    const url = request.nextUrl.clone();
    const [pathOnly, query] = target.location.split("?");
    url.pathname = pathOnly || "/";
    url.search = query ? `?${query}` : "";
    return applySecurityHeaders(NextResponse.redirect(url));
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
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon|branding/|icons/|sw\\.js|offline\\.html|manifest\\.webmanifest).*)",
  ],
};
