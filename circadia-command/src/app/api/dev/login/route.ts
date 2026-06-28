import { CommandApiError, apiErrorResponse } from "@/lib/errors";

/** Dev login removed — use POST /api/auth/login with email + password. */
export async function POST() {
  return apiErrorResponse(
    new CommandApiError(
      "ERR_FORBIDDEN",
      "Dev login is disabled. Use email and password sign-in.",
      403
    )
  );
}
