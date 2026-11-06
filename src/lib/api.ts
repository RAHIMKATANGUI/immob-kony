import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { getSession } from "./auth/session";
import type { SessionPayload } from "./auth/jwt";
import { ApiError, unauthorized } from "./errors";
import { assertCan, type Permission } from "./rbac";
import { enforceRateLimit } from "./rate-limit";

export interface Ctx<P = Record<string, string>> {
  req: NextRequest;
  session: SessionPayload;
  params: P;
  ip: string;
  userAgent: string | null;
}

type Handler<P> = (ctx: Ctx<P>) => Promise<unknown>;

interface Options {
  permission?: Permission;
  /** requêtes / minute par utilisateur pour les mutations */
  rateLimit?: number;
}

export function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) return json({ error: err.message, details: err.details }, err.status);
  if (err instanceof ZodError) {
    return json({ error: "Données invalides", details: err.flatten() }, 422);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return json({ error: "Cet enregistrement existe déjà (valeur unique en doublon)." }, 409);
    if (err.code === "P2025") return json({ error: "Ressource introuvable" }, 404);
    if (err.code === "P2003") return json({ error: "Opération impossible : des données liées existent." }, 409);
  }
  console.error("[api] erreur non gérée", err);
  return json({ error: "Erreur interne du serveur" }, 500);
}

/**
 * Enveloppe standard des routes API :
 * authentification JWT, contrôle RBAC, limitation de débit, gestion d'erreurs uniforme.
 */
export function route<P = Record<string, string>>(opts: Options, fn: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const session = await getSession();
      if (!session) throw unauthorized();
      if (opts.permission) assertCan(session, opts.permission);
      const ip = clientIp(req);
      if (req.method !== "GET") {
        enforceRateLimit(`mut:${session.sub}`, 120, 60_000); // plafond global par utilisateur
        if (opts.rateLimit) enforceRateLimit(`mut:${session.sub}:${req.method}:${req.nextUrl.pathname}`, opts.rateLimit, 60_000); // plafond spécifique à la route
      } else enforceRateLimit(`get:${session.sub}`, 600, 60_000);
      const params = (await context?.params) ?? ({} as P);
      const result = await fn({ req, session, params, ip, userAgent: req.headers.get("user-agent") });
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Corps JSON invalide");
  }
  return schema.parse(body);
}

export function pagination(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? 20) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, q: sp.get("q")?.trim() || undefined };
}

export const paged = <T>(items: T[], total: number, page: number, pageSize: number) => ({
  items,
  total,
  page,
  pageSize,
  pages: Math.max(1, Math.ceil(total / pageSize)),
});
