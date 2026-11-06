import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, errorResponse, json } from "@/lib/api";
import { loginSchema } from "@/lib/validations";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/errors";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    enforceRateLimit(`login-ip:${ip}`, 20, 15 * 60_000);
    const { email, password } = loginSchema.parse(await req.json());
    enforceRateLimit(`login:${email}`, 10, 15 * 60_000);

    const user = await prisma.user.findUnique({ where: { email }, include: { manager: true } });
    // Message identique que l'utilisateur existe ou non (pas d'énumération de comptes)
    const invalid = new ApiError(401, "Email ou mot de passe incorrect");
    if (!user || !user.isActive) {
      await verifyPassword(password, "$2b$12$/YJV7ghpASr0y8RIhBCAw.dAx.nhm29G.B9IfUJYVvNM3118fFYLq"); // temps constant
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError(423, `Compte temporairement verrouillé. Réessayez après ${user.lockedUntil.toLocaleTimeString("fr-FR")}.`);
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const count = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: count >= MAX_ATTEMPTS ? 0 : count, lockedUntil: count >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      throw invalid;
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    resetRateLimit(`login:${email}`);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
      managerId: user.manager?.id ?? null,
      onboarded: user.onboardingCompleted,
    };
    await setSessionCookie(payload);
    await audit({ session: payload, ip, userAgent: req.headers.get("user-agent") }, "LOGIN", "User", user.id);
    return json({ user: { id: user.id, email: user.email, role: user.role, name: payload.name, onboarded: user.onboardingCompleted } });
  } catch (e) {
    return errorResponse(e);
  }
}
