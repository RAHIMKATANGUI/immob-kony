"use client";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { KeyRound, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { onError } from "@/hooks/use-resource";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { changePasswordSchema, settingsSchema } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { ROLES } from "@/lib/labels";

type SIn = z.input<typeof settingsSchema>;
type SOut = z.output<typeof settingsSchema>;
type PIn = z.input<typeof changePasswordSchema>;

function AgencySettings() {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<SOut>("/api/settings") });
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<SIn, unknown, SOut>({ resolver: zodResolver(settingsSchema) });
  useEffect(() => { if (data) reset({ ...data, agencyAddress: data.agencyAddress ?? "", agencyPhone: data.agencyPhone ?? "", agencyEmail: data.agencyEmail ?? "", defaultClauses: data.defaultClauses ?? "" }); }, [data, reset]);
  const save = useMutation({ mutationFn: (d: SOut) => apiPut("/api/settings", d), onSuccess: () => { toast.success("Paramètres enregistrés"); qc.invalidateQueries({ queryKey: ["settings"] }); }, onError });
  const enabled = watch("remindersEnabled");
  return (
    <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
      <fieldset disabled={!isAdmin} className="space-y-4">
        <Section title="Agence" description="Informations reprises sur les reçus, contrats et emails.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom de l'agence" required error={errors.agencyName?.message}><Input {...register("agencyName")} /></FormField>
            <FormField label="Devise (ISO)" error={errors.currency?.message} hint="XOF = Franc CFA"><Input maxLength={3} {...register("currency")} /></FormField>
            <FormField label="Adresse"><Input {...register("agencyAddress")} /></FormField>
            <FormField label="Téléphone"><Input {...register("agencyPhone")} /></FormField>
            <FormField label="Email" error={errors.agencyEmail?.message}><Input type="email" {...register("agencyEmail")} /></FormField>
            <label className="flex items-center gap-3 self-end rounded-xl border p-3 text-sm"><Switch checked={!!enabled} onCheckedChange={(v) => setValue("remindersEnabled", v)} /> Relances automatiques activées</label>
          </div>
        </Section>
        <Section title="Clauses par défaut du contrat de bail">
          <Textarea rows={12} className="font-mono text-xs" {...register("defaultClauses")} />
        </Section>
      </fieldset>
      {isAdmin ? <Button type="submit" loading={save.isPending}>Enregistrer</Button> : <p className="text-sm text-muted-foreground">Seul un super administrateur peut modifier ces paramètres.</p>}
    </form>
  );
}

function SecuritySettings() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PIn>({ resolver: zodResolver(changePasswordSchema) });
  const save = useMutation({ mutationFn: (d: PIn) => apiPost("/api/auth/password", d), onSuccess: () => { toast.success("Mot de passe modifié"); reset(); }, onError });
  return (
    <Section title="Mot de passe" description="10 caractères minimum avec majuscule, minuscule et chiffre.">
      <form onSubmit={handleSubmit((d) => save.mutate(d))} className="grid max-w-md gap-4">
        <FormField label="Mot de passe actuel" error={errors.currentPassword?.message}><Input type="password" autoComplete="current-password" {...register("currentPassword")} /></FormField>
        <FormField label="Nouveau mot de passe" error={errors.newPassword?.message}><Input type="password" autoComplete="new-password" {...register("newPassword")} /></FormField>
        <FormField label="Confirmation" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register("confirm")} /></FormField>
        <Button type="submit" className="w-fit" loading={save.isPending}><KeyRound /> Modifier</Button>
      </form>
    </Section>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  return (
    <Section title="Apparence" description="Mode clair, sombre ou selon le système.">
      <div className="grid max-w-lg grid-cols-3 gap-3">
        {[{ v: "light", l: "Clair", I: Sun }, { v: "dark", l: "Sombre", I: Moon }, { v: "system", l: "Système", I: Monitor }].map(({ v, l, I }) => (
          <button key={v} type="button" onClick={() => setTheme(v)} className={cn("flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm transition", theme === v ? "border-brand bg-accent text-accent-foreground" : "hover:bg-muted")}>
            <I className="size-5" /> {l}
          </button>
        ))}
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const s = useSession();
  return (
    <>
      <PageHeader title="Paramètres" description={`${s.name} · ${s.email} · ${ROLES[s.role]}`} />
      <Tabs defaultValue="agency">
        <TabsList>
          <TabsTrigger value="agency">Agence</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
          <TabsTrigger value="appearance">Apparence</TabsTrigger>
        </TabsList>
        <TabsContent value="agency"><AgencySettings /></TabsContent>
        <TabsContent value="security"><SecuritySettings /></TabsContent>
        <TabsContent value="appearance"><Appearance /></TabsContent>
      </Tabs>
    </>
  );
}
