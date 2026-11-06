import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { onboardingSchema } from "@/lib/validations";
import { setSessionCookie } from "@/lib/auth/session";
import { nextCode } from "@/lib/sequence";
import { audit } from "@/lib/audit";

/** Assistant de configuration (première connexion) : profil gestionnaire + premier propriétaire. */
export const POST = route({}, async (ctx) => {
  const { manager, owner } = await parseBody(ctx.req, onboardingSchema);
  const result = await prisma.$transaction(async (tx) => {
    const m = await tx.manager.upsert({
      where: { userId: ctx.session.sub },
      create: { ...manager, userId: ctx.session.sub },
      update: manager,
    });
    const o = await tx.owner.create({ data: { ...owner, code: await nextCode("PRO", tx), createdById: ctx.session.sub } });
    const u = await tx.user.update({
      where: { id: ctx.session.sub },
      data: { firstName: manager.firstName, lastName: manager.lastName, phone: manager.phone, onboardingCompleted: true },
    });
    return { m, o, u };
  });
  await audit(ctx, "CREATE", "Manager", result.m.id, null, result.m);
  await audit(ctx, "CREATE", "Owner", result.o.id, null, result.o);
  await setSessionCookie({ ...ctx.session, name: `${result.u.firstName} ${result.u.lastName}`, managerId: result.m.id, onboarded: true });
  return { manager: result.m, owner: result.o };
});
