import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { json } from "@/lib/api";
import { runReminders } from "@/lib/services/reminder.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !header) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Tâche planifiée quotidienne (Render Cron Job) :
 * génération des loyers du mois, statuts de retard, relances J-7/J-3/J-1/J+1/J+7/J+15.
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) return json({ error: "Non autorisé" }, 401);
  const started = Date.now();
  const result = await runReminders();
  console.info("[cron] relances", result);
  return json({ ok: true, durationMs: Date.now() - started, ...result });
}

export const POST = handle;
export const GET = handle;
