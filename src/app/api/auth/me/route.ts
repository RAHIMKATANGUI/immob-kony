import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { notFound } from "@/lib/errors";

export const GET = route({}, async ({ session }) => {
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, avatarUrl: true, onboardingCompleted: true, lastLoginAt: true, manager: true },
  });
  if (!user) throw notFound();
  return { user };
});
