import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validations";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { badRequest } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = route({ rateLimit: 10 }, async (ctx) => {
  const body = await parseBody(ctx.req, changePasswordSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.session.sub } });
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) throw badRequest("Mot de passe actuel incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  await audit(ctx, "UPDATE", "User", user.id, { password: "***" }, { password: "modifié" });
  return { ok: true };
});
