import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, service: "circadia-command" });
  } catch {
    return Response.json({ ok: false, service: "circadia-command" }, { status: 503 });
  }
}
