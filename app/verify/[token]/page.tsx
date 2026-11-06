import type { Metadata } from "next";
import { BadgeCheck, ShieldX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/layout/logo";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Vérification de reçu" };
export const dynamic = "force-dynamic";

/** Page publique ciblée par le QR code des reçus : authenticité sans données personnelles sensibles. */
export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = /^[a-z0-9]{20,40}$/i.test(token)
    ? await prisma.receipt.findUnique({ where: { verifyToken: token }, include: { payment: { include: { lease: { include: { tenant: true, residence: true } } } } } })
    : null;
  const tenant = receipt?.payment.lease.tenant;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-grid px-4 py-10">
      <Logo />
      <div className="glass mt-8 w-full max-w-md rounded-3xl p-8 text-center shadow-soft">
        {receipt ? (
          <>
            <BadgeCheck className="mx-auto size-14 text-success" />
            <h1 className="mt-4 text-xl font-bold">Reçu authentique</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ce reçu a bien été émis par IMMOB KONY.</p>
            <dl className="mt-6 grid gap-3 text-left text-sm">
              {[
                ["Numéro", receipt.number],
                ["Montant", formatMoney(receipt.amount)],
                ["Objet", receipt.label],
                ["Date de paiement", formatDate(receipt.payment.paidAt, { month: "long" })],
                ["Locataire", tenant ? `${tenant.firstName} ${tenant.lastName.charAt(0)}.` : "—"],
                ["Résidence", receipt.payment.lease.residence.name],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b pb-2 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          </>
        ) : (
          <>
            <ShieldX className="mx-auto size-14 text-destructive" />
            <h1 className="mt-4 text-xl font-bold">Reçu introuvable</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ce code ne correspond à aucun reçu émis. Méfiez-vous des documents falsifiés.</p>
          </>
        )}
      </div>
    </div>
  );
}
