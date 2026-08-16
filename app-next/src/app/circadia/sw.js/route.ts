import { NextResponse } from "next/server";

const SOURCE = `/* Circadia client manager — desktop PWA shell. Scope must stay /circadia/. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
`;

export async function GET() {
  return new NextResponse(SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/circadia/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
