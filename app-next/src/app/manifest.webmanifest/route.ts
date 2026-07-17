import { NextResponse } from "next/server";
import {
  appSurfaceTagline,
  documentTitleForSurface,
  getAppSurface,
} from "@/lib/app-surface";

/**
 * Host-aware web app manifest so installed shortcuts match EWD / Enterprise / Legacy.
 * Replaces the static public/manifest.webmanifest.
 */
export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const surface = getAppSurface(host);
  const name = documentTitleForSurface(surface);
  const startUrl =
    surface === "enterprise" ? "/manager" : surface === "ewd" ? "/driver" : "/driver";

  const body = {
    name,
    short_name: name,
    description: `${name} — ${appSurfaceTagline(surface)}`,
    start_url: startUrl,
    scope: "/",
    display: "fullscreen",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
