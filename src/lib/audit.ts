import type { AuditAction, Prisma } from "@prisma/client";
import { prisma, type Tx } from "./prisma";
import type { SessionPayload } from "./auth/jwt";

type Ctx = { session: SessionPayload | null; ip?: string | null; userAgent?: string | null };

const SENSITIVE = new Set(["passwordHash", "password", "token"]);

function sanitize(obj: unknown): Prisma.InputJsonValue | undefined {
  if (obj === undefined || obj === null) return undefined;
  return JSON.parse(
    JSON.stringify(obj, (k, v) => (SENSITIVE.has(k) ? "[masqué]" : typeof v === "bigint" ? v.toString() : v)),
  );
}

/** Ne conserve que les champs modifiés (ancienne / nouvelle valeur). */
export function diff(oldObj: Record<string, unknown>, newObj: Record<string, unknown>) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const key of Object.keys(newObj)) {
    if (["updatedAt", "createdAt"].includes(key)) continue;
    const a = JSON.stringify(oldObj[key] ?? null);
    const b = JSON.stringify(newObj[key] ?? null);
    if (a !== b) {
      before[key] = oldObj[key] ?? null;
      after[key] = newObj[key] ?? null;
    }
  }
  return { before, after, changed: Object.keys(after).length > 0 };
}

export async function audit(
  ctx: Ctx,
  action: AuditAction,
  entity: string,
  entityId: string | null,
  oldValue?: unknown,
  newValue?: unknown,
  db: Tx = prisma,
) {
  try {
    await db.auditLog.create({
      data: {
        userId: ctx.session?.sub ?? null,
        userEmail: ctx.session?.email ?? null,
        action,
        entity,
        entityId,
        oldValue: sanitize(oldValue),
        newValue: sanitize(newValue),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 255) ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] échec d'écriture", e);
  }
}
