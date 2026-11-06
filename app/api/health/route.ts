import { prisma } from "@/lib/prisma";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: "ok", db: "up", time: new Date().toISOString(), version: process.env.npm_package_version ?? "1.0.0" });
  } catch {
    return json({ status: "degraded", db: "down" }, 503);
  }
}
