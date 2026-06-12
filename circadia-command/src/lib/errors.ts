export class CommandApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "CommandApiError";
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof CommandApiError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status }
    );
  }
  console.error(error);
  return Response.json(
    { error: "ERR_INTERNAL", message: "Unexpected server error." },
    { status: 500 }
  );
}
