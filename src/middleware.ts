import { NextResponse, type NextRequest } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";

/**
 * Middleware global :
 *  - protection des pages et des API par JWT (cookie httpOnly)
 *  - protection CSRF (double-submit cookie + vérification de l'origine) sur les mutations
 *  - redirection vers l'assistant de configuration à la première connexion
 */
const PUBLIC_PAGES = ["/login", "/verify"];
const PUBLIC_API = ["/api/auth/login", "/api/health", "/api/cron"];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isPublic(path: string, list: string[]) {
  return list.some((p) => path === p || path.startsWith(`${p}/`));
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function withCsrfCookie(req: NextRequest, res: NextResponse) {
  if (!req.cookies.get(CSRF_COOKIE)) {
    res.cookies.set(CSRF_COOKIE, randomToken(), {
      httpOnly: false, // lisible par le client pour le renvoyer en en-tête
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // --- CSRF -------------------------------------------------------------
  if (isApi && MUTATING.has(req.method) && !pathname.startsWith("/api/cron")) {
    const cookie = req.cookies.get(CSRF_COOKIE)?.value;
    const header = req.headers.get(CSRF_HEADER);
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const sameOrigin = !origin || (host !== null && new URL(origin).host === host);
    if (!cookie || !header || cookie !== header || !sameOrigin) {
      return NextResponse.json({ error: "Jeton CSRF invalide ou manquant" }, { status: 403 });
    }
  }

  if (isApi && isPublic(pathname, PUBLIC_API)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (isPublic(pathname, PUBLIC_PAGES)) {
    if (session && pathname === "/login") return NextResponse.redirect(new URL(session.onboarded ? "/dashboard" : "/onboarding", req.url));
    return withCsrfCookie(req, NextResponse.next());
  }

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return withCsrfCookie(req, NextResponse.redirect(url));
  }

  if (!isApi) {
    if (!session.onboarded && pathname !== "/onboarding") return NextResponse.redirect(new URL("/onboarding", req.url));
    if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return withCsrfCookie(req, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
