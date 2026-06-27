/**
 * In-memory rate limiting (per process). Use for login and sensitive API routes.
 * For multi-instance deployments, consider Redis (e.g. Upstash) instead.
 */

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 10;
const SENSITIVE_API_WINDOW_MS = 60 * 1000; // 1 minute
const SENSITIVE_API_MAX_REQUESTS = 30;

type Entry = { count: number; resetAt: number };

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function prune(store: Map<string, Entry>): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}

const loginStore = new Map<string, Entry>();

/** Returns a 429 Response if over limit; otherwise null (caller should proceed). */
export function checkLoginRateLimit(req: Request): Response | null {
  const ip = getClientIp(req);
  const now = Date.now();
  if (loginStore.size > 10000) prune(loginStore);
  let entry = loginStore.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginStore.set(ip, entry);
  }
  entry.count++;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return new Response(
      JSON.stringify({
        error: "Too many sign-in attempts. Please try again later.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(LOGIN_WINDOW_MS / 1000)),
        },
      }
    );
  }
  return null;
}

const sensitiveApiStore = new Map<string, Entry>();

/** Rate limit for sensitive APIs (e.g. create user, create sheet). Returns 429 Response if over limit; otherwise null. */
export function checkSensitiveApiRateLimit(req: Request): Response | null {
  const ip = getClientIp(req);
  const now = Date.now();
  if (sensitiveApiStore.size > 10000) prune(sensitiveApiStore);
  let entry = sensitiveApiStore.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + SENSITIVE_API_WINDOW_MS };
    sensitiveApiStore.set(ip, entry);
  }
  entry.count++;
  if (entry.count > SENSITIVE_API_MAX_REQUESTS) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }
  return null;
}
