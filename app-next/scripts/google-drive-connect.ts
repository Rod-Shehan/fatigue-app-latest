/**
 * One-time: sign in as circadia24@gmail.com and print a refresh token.
 *
 * From app-next, with GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET set:
 *   npx tsx scripts/google-drive-connect.ts
 *
 * Add http://127.0.0.1:8765/callback as an authorized redirect URI on the OAuth client.
 */
import { createServer } from "node:http";
import { exchangeGoogleAuthCode, googleAuthorizeUrl } from "../src/lib/pdf-drop/google-auth";
import { CIRCADIA_DRIVE_GMAIL } from "../src/lib/pdf-drop/mailbox";

const PORT = 8765;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;

async function main() {
  const url = googleAuthorizeUrl(REDIRECT);
  const server = createServer(async (req, res) => {
    const incoming = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (incoming.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const err = incoming.searchParams.get("error");
    const code = incoming.searchParams.get("code");
    if (err || !code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(err || "Missing code");
      server.close();
      process.exit(1);
      return;
    }
    try {
      const tokens = await exchangeGoogleAuthCode({ code, redirectUri: REDIRECT });
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Connected ${tokens.email}. You can close this tab and return to the terminal.`);
      console.log(`\nConnected ${tokens.email}`);
      console.log("Add this to local/prod env (do not commit it):\n");
      console.log(`PDF_DROP_PROVIDER=google`);
      console.log(`GOOGLE_DRIVE_USER_EMAIL=${CIRCADIA_DRIVE_GMAIL}`);
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refreshToken}\n`);
      server.close();
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connect failed";
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(message);
      console.error(message);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Sign in as ${CIRCADIA_DRIVE_GMAIL} (not another Google account).`);
    console.log(url);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
