/** Neon LISTEN/NOTIFY requires a direct (non-pooler) Postgres connection. */
export function getDirectDatabaseUrl(): string {
  if (process.env.DATABASE_URL_UNPOOLED) {
    return process.env.DATABASE_URL_UNPOOLED;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url.replace("-pooler.", ".");
}
