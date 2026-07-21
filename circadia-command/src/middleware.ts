import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/triage", "/tracking", "/admin", "/api/v1"];

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const allowlist = process.env.COMMAND_OPERATOR_IP_WHITELIST?.split(",").map((s) => s.trim()) ?? [];
  if (allowlist.length === 0) return NextResponse.next();

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "";

  const ok = allowlist.some((ip) => clientIp.includes(ip));
  if (!ok) {
    return NextResponse.json(
      { error: "ERR_IP_OUT_OF_BOUNDS", message: "Access from unauthorized network denied." },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/triage",
    "/triage/:path*",
    "/tracking",
    "/tracking/:path*",
    "/admin/:path*",
    "/api/v1/:path*",
  ],
};
