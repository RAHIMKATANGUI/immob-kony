import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-night-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(to_right,#ffffff22_1px,transparent_1px),linear-gradient(to_bottom,#ffffff22_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -left-24 top-1/3 size-[480px] rounded-full bg-turquoise-500/25 blur-[120px]" />
        <div className="absolute -right-24 -top-24 size-[380px] rounded-full bg-night-400/30 blur-[120px]" />
        <Logo className="relative" />
        <div className="relative mt-auto max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-turquoise-300 backdrop-blur">
            <Sparkles className="size-3.5" /> Plateforme de gestion immobilière
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight xl:text-5xl">
            Pilotez vos loyers <span className="text-turquoise-400">en toute sérénité.</span>
          </h1>
          <p className="mt-4 text-base text-slate-300">Résidences, locataires, baux, encaissements, reçus et relances automatiques — réunis dans un seul espace.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { I: Building2, t: "Patrimoine", d: "Résidences & logements" },
              { I: Wallet, t: "Encaissements", d: "Reçus PDF + QR code" },
              { I: ShieldCheck, t: "Sécurité", d: "JWT, RBAC & audit" },
            ].map(({ I, t, d }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                <I className="size-5 text-turquoise-400" />
                <p className="mt-3 text-sm font-semibold">{t}</p>
                <p className="text-xs text-slate-400">{d}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative mt-10 text-xs text-slate-500">© {new Date().getFullYear()} IMMOB KONY</p>
      </div>
      <div className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="font-display text-2xl font-bold">Bon retour</h2>
          <p className="mt-1 text-sm text-muted-foreground">Connectez-vous à votre espace de gestion.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
