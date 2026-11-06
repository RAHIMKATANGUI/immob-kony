import { SignJWT, jwtVerify } from "jose";

/** Compatible Edge (middleware) et Node. */
export const SESSION_COOKIE = "ik_session";
export const CSRF_COOKIE = "ik_csrf";
export const CSRF_HEADER = "x-csrf-token";

export type Role = "SUPER_ADMIN" | "MANAGER";

export interface SessionPayload {
  sub: string; // user id
  email: string;
  role: Role;
  name: string;
  managerId: string | null;
  onboarded: boolean;
}

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET manquant ou trop court (32 caractères min.)");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload, expiresIn = process.env.JWT_EXPIRES_IN ?? "8h") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("immob-kony")
    .setAudience("immob-kony-app")
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "immob-kony", audience: "immob-kony-app", algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
