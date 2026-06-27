import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { logLoginAttempt } from "@/lib/auth-login-audit";
import { checkLoginRateLimit, getClientIp } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

async function guardLoginPost(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.includes("/callback/credentials") && !url.pathname.endsWith("/signin/credentials")) {
    return null;
  }
  const limited = checkLoginRateLimit(req);
  if (limited) {
    logLoginAttempt({ outcome: "rate_limited", ip: getClientIp(req) });
    return limited;
  }
  return null;
}

export async function GET(req: Request, context: RouteContext) {
  return handler(req, context);
}

export async function POST(req: Request, context: RouteContext) {
  const blocked = await guardLoginPost(req);
  if (blocked) return blocked;
  return handler(req, context);
}
