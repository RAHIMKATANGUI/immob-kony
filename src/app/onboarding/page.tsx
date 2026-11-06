import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Configuration initiale" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.onboarded) redirect("/dashboard");
  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { firstName: true, lastName: true, email: true, phone: true } });
  return <OnboardingWizard defaults={{ firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", email: user?.email ?? "", phone: user?.phone ?? "" }} />;
}
