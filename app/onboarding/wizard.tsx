"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Landmark, PartyPopper, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Logo } from "@/components/layout/logo";
import { onboardingSchema } from "@/lib/validations";
import { apiPost, HttpError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type In = z.input<typeof onboardingSchema>;
type Out = z.output<typeof onboardingSchema>;

const STEPS = [
  { title: "Vos informations", desc: "Profil du gestionnaire", icon: UserRound },
  { title: "Premier propriétaire", desc: "Bailleur de vos résidences", icon: Landmark },
  { title: "Récapitulatif", desc: "Vérification et validation", icon: Check },
];

export function OnboardingWizard({ defaults }: { defaults: { firstName: string; lastName: string; email: string; phone: string } }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { manager: { ...defaults, address: "", company: "" }, owner: { firstName: "", lastName: "", phone: "", email: "", address: "" } },
    mode: "onTouched",
  });
  const { register, formState: { errors, isSubmitting }, trigger, getValues, handleSubmit } = form;

  const next = async () => {
    const ok = await trigger(step === 0 ? "manager" : "owner");
    if (ok) setStep((s) => s + 1);
  };

  const submit = handleSubmit(async (data) => {
    try {
      await apiPost("/api/onboarding", data);
      toast.success("Configuration terminée ! Bienvenue sur IMMOB KONY.");
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof HttpError ? e.message : "Erreur lors de l'enregistrement");
    }
  });

  const person = (prefix: "manager" | "owner") => {
    const e = errors[prefix];
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Prénom" required error={e?.firstName?.message}><Input {...register(`${prefix}.firstName`)} /></FormField>
        <FormField label="Nom" required error={e?.lastName?.message}><Input {...register(`${prefix}.lastName`)} /></FormField>
        <FormField label="Téléphone" required error={e?.phone?.message}><Input type="tel" placeholder="+225 07 00 00 00 00" {...register(`${prefix}.phone`)} /></FormField>
        <FormField label="Email" required error={e?.email?.message}><Input type="email" {...register(`${prefix}.email`)} /></FormField>
        <FormField label="Adresse" required error={e?.address?.message} className="sm:col-span-2"><Input placeholder="Quartier, commune, ville" {...register(`${prefix}.address`)} /></FormField>
        {prefix === "manager" && (
          <FormField label="Société / agence" className="sm:col-span-2"><Input placeholder="Facultatif" {...register("manager.company")} /></FormField>
        )}
      </div>
    );
  };

  const v = getValues();
  return (
    <div className="min-h-dvh bg-grid">
      <div className="mx-auto flex max-w-3xl flex-col px-4 py-10">
        <Logo className="mx-auto" />
        <div className="mt-8 text-center">
          <h1 className="font-display text-3xl font-bold">Configurons votre espace</h1>
          <p className="mt-2 text-sm text-muted-foreground">Quelques informations pour démarrer. Vous pourrez les modifier à tout moment.</p>
        </div>

        <ol className="mx-auto mt-8 flex w-full max-w-xl items-center">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span className={cn("flex size-10 items-center justify-center rounded-full border-2 transition-all", i < step ? "border-brand bg-brand text-brand-foreground" : i === step ? "border-brand bg-card text-brand shadow-glow" : "border-border bg-card text-muted-foreground")}>
                  {i < step ? <Check className="size-4" /> : <s.icon className="size-4" />}
                </span>
                <span className="hidden text-xs font-medium sm:block">{s.title}</span>
              </div>
              {i < STEPS.length - 1 && <span className={cn("mx-2 h-0.5 flex-1 rounded-full transition-colors sm:mb-5", i < step ? "bg-brand" : "bg-border")} />}
            </li>
          ))}
        </ol>

        <div className="glass mt-8 rounded-3xl p-5 shadow-soft sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              <h2 className="text-lg font-semibold">{STEPS[step].title}</h2>
              <p className="mb-6 text-sm text-muted-foreground">{STEPS[step].desc}</p>
              {step === 0 && person("manager")}
              {step === 1 && person("owner")}
              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["manager", "owner"] as const).map((k) => (
                    <div key={k} className="rounded-2xl border bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-brand">{k === "manager" ? "Gestionnaire" : "Propriétaire"}</p>
                      <p className="mt-2 font-semibold">{v[k].firstName} {v[k].lastName}</p>
                      <p className="text-sm text-muted-foreground">{v[k].phone}</p>
                      <p className="text-sm text-muted-foreground">{v[k].email}</p>
                      <p className="text-sm text-muted-foreground">{v[k].address}</p>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 rounded-2xl bg-accent p-4 text-sm text-accent-foreground sm:col-span-2">
                    <PartyPopper className="size-5 shrink-0" /> Étape suivante : créez votre première résidence et ses appartements.
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}><ArrowLeft /> Retour</Button>
            {step < 2 ? (
              <Button onClick={next}>Continuer <ArrowRight /></Button>
            ) : (
              <Button variant="brand" onClick={submit} loading={isSubmitting}>Terminer la configuration</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
