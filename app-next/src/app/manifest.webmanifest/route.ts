import { NextResponse } from "next/server";
import { appSurfaceTagline, documentTitleForSurface, getAppSurface } from "@/lib/app-surface";
import { pwaIconPathsForSurface } from "@/lib/branding";
import { circadiaDeskManifest } from "@/lib/circadia-desk";

/**
 * Host-aware web app manifest so installed shortcuts match Helper / EWD / Enterprise / Circadia desk.
 */
export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const surface = getAppSurface(host);

  if (surface === "circadia") {
    return NextResponse.json(circadiaDeskManifest({ hostScoped: true }), {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  }

  const name = documentTitleForSurface(surface);
  const shortName =
    surface === "enterprise" ? "Enterprise" : surface === "ewd" ? "EWD" : "Helper";
  const startUrl =
    surface === "enterprise" ? "/manager" : surface === "ewd" ? "/driver" : "/driver";
  const icons = pwaIconPathsForSurface(surface);

  const body = {
    name,
    short_name: shortName,
    description: `${name} — ${appSurfaceTagline(surface)}`,
    start_url: startUrl,
    scope: "/",
    display: "fullscreen",
    background_color: "#0A1118",
    theme_color: "#0A1118",
    icons: [
      {
        src: icons.icon180,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: icons.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: icons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: icons.icon512Maskable,
        sizes: "512x512",
        type: "image/png",
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
