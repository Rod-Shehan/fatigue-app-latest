import { NextResponse } from "next/server";
import { getAppSurface } from "@/lib/app-surface";
import { circadiaDeskManifest } from "@/lib/circadia-desk";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const surface = getAppSurface(host);
  const body = circadiaDeskManifest({ hostScoped: surface === "circadia" });
  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
