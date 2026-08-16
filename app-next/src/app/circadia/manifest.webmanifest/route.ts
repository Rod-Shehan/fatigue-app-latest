import { NextResponse } from "next/server";
import { circadiaDeskManifest } from "@/lib/circadia-desk";

export async function GET() {
  return NextResponse.json(circadiaDeskManifest(), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
