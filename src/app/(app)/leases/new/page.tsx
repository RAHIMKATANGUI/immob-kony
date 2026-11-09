"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { leaseSchema } from "@/lib/validations";
import { PAYMENT_METHODS } from "@/lib/labels";
import { apiGet, apiPost, HttpError } from "@/lib/api-client";
import { useOptions } from "@/hooks/use-options";
import { addMonthsLabel, formatMoney } from "@/lib/format-client";

type In = z.input<typeof leaseSchema>;
type Out = z.output<typeof leaseSchema>;

function NewLeaseForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<{ defaultClauses: string | null }>("/api/settings") });
  const { register, handleSubmit, setValue, control, getValues, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({
    resolver: zodResolver(leaseSchema),
    defaultValues: {
      tenantId: sp.get("tenantId") ?? "", residenceId: sp.get("residenceId") ?? "", apartmentId: sp.get("apartmentId") ?? "",
      startDate: new Date().toISOString().slice(0, 10), durationMonths: 12, monthlyRent: 0, charges: 0, dueDay: 5, depositAmount: 0, advanceAmount: 0, advanceMonthly: 0, advanceMethod: "CASH", clauses: "", activate: true,
    },
  });
  const [residenceId, apartmentId, startDate, duration, rent, charges, deposit, advance, advanceMonthly] = useWatch({ control, name: ["residenceId", "apartmentId", "startDate", "durationMonths", "monthlyRent", "charges", "depositAmount", "advanceAmount", "advanceMonthly"] });
  const tenants = useOptions("tenants", "&state=active");
  const residences = useOptions("residences");
  const apartments = useOptions("apartments", `&residenceId=${residenceId}`, !!residenceId);

  useEffect(() => { if (settings.data?.defaultClauses && !getValues("clauses")) setValue("clauses", settings.data.defaultClauses); }, [settings.data, getValues, setValue]);
  useEffect(() => {
    const apt = apartments.data?.find((a) => a.id === apartmentId) as unknown as { baseRent?: string } | undefined;
    if (apt?.baseRent && !Number(getValues("monthlyRent"))) {
      setValue("monthlyRent", Number(apt.baseRent));
      setValue("depositAmount", Number(apt.baseRent) * 2);
    }
  }, [apartmentId, apartments.data, getValues, setValue]);

  const onSubmit = async (data: Out) => {
    try {
      const lease = await apiPost<{ id: string }>("/api/leases", data);
      await qc.invalidateQueries();
      toast.success("Bail créé — contrat disponible en PDF");
      router.push(`/leases/${lease.id}`);
    } catch (e) {
      toast.error(e instanceof HttpError ? e.message : "Erreur");
    }
  };
  const total = (Number(rent) || 0) + (Number(charges) || 0);
  const perMonth = Number(advanceMonthly) > 0 ? Number(advanceMonthly) : total;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-3" noValidate>
      <div className="space-y-4 lg:col-span-2">
        <Section title="Parties & logement">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Locataire" required error={errors.tenantId?.message} className="sm:col-span-2">
              <NativeSelect {...register("tenantId")}>
                <option value="">Sélectionner…</option>
                {tenants.data?.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="Résidence" required error={errors.residenceId?.message}>
              <NativeSelect {...register("residenceId", { onChange: () => setValue("apartmentId", "") })}>
                <option value="">Sélectionner…</option>
                {residences.data?.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="Appartement" hint="Laisser vide pour un bail sur la résidence">
              <NativeSelect {...register("apartmentId")} disabled={!residenceId}>
                <option value="">— Aucun —</option>
                {apartments.data?.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </NativeSelect>
            </FormField>
          </div>
        </Section>
        <Section title="Conditions financières">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Loyer mensuel" required error={errors.monthlyRent?.message}><Input type="number" step="1000" {...register("monthlyRent")} /></FormField>
            <FormField label="Charges mensuelles" error={errors.charges?.message}><Input type="number" step="500" {...register("charges")} /></FormField>
            <FormField label="Jour d'échéance" error={errors.dueDay?.message} hint="1 à 28"><Input type="number" min={1} max={28} {...register("dueDay")} /></FormField>
            <FormField label="Date de début" required error={errors.startDate?.message}><Input type="date" {...register("startDate")} /></FormField>
            <FormField label="Durée (mois)" required error={errors.durationMonths?.message}><Input type="number" min={1} {...register("durationMonths")} /></FormField>
            <FormField label="Caution (dépôt de garantie)" error={errors.depositAmount?.message}><Input type="number" step="1000" {...register("depositAmount")} /></FormField>
              <FormField label="Avance sur loyer" error={errors.advanceAmount?.message} hint="Montant libre versé à l'entrée"><Input type="number" step="1000" {...register("advanceAmount")} /></FormField>
              <FormField label="Déduction mensuelle de l'avance" error={errors.advanceMonthly?.message} hint="Retirée du loyer chaque mois (0 = loyer complet)"><Input type="number" step="1000" {...register("advanceMonthly")} /></FormField>
              <FormField label="Paiement de l'avance"><NativeSelect {...register("advanceMethod")}>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></FormField>
          </div>
        </Section>
        <Section title="Clauses du contrat" description="Pré-remplies avec vos clauses par défaut (Paramètres).">
          <Textarea rows={12} className="font-mono text-xs" {...register("clauses")} />
        </Section>
      </div>
      <div className="space-y-4">
        <div className="sticky top-20 space-y-4">
          <Section title="Récapitulatif">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Mensualité totale</dt><dd className="font-semibold">{formatMoney(total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Caution</dt><dd className="font-semibold">{formatMoney(deposit)}</dd></div>
                  {Number(advance) > 0 && (
                    <>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Avance sur loyer</dt><dd className="font-semibold">{formatMoney(advance)}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Déduite par mois</dt><dd className="font-semibold">{formatMoney(perMonth)}{perMonth > 0 ? ` · ${Math.ceil(Number(advance) / perMonth)} mois` : ""}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted-foreground">Le locataire paie par mois</dt><dd className="font-semibold">{formatMoney(Math.max(0, total - perMonth))}</dd></div>
                    </>
                  )}
              <div className="flex justify-between"><dt className="text-muted-foreground">Fin du bail</dt><dd className="font-semibold">{addMonthsLabel(String(startDate), Number(duration) || 0)}</dd></div>
              <div className="flex justify-between border-t pt-3"><dt className="text-muted-foreground">Montant total du bail</dt><dd className="font-display text-lg font-bold text-brand">{formatMoney(total * (Number(duration) || 0))}</dd></div>
            </dl>
            <label className="mt-5 flex items-center gap-3 text-sm"><Switch defaultChecked onCheckedChange={(v) => setValue("activate", v)} /> Activer immédiatement (génère l&apos;échéancier)</label>
          </Section>
          <Button type="submit" variant="brand" className="w-full" size="lg" loading={isSubmitting}>Créer le bail</Button>
        </div>
      </div>
    </form>
  );
}

export default function NewLeasePage() {
  return (
    <>
      <PageHeader back={{ href: "/leases", label: "Baux" }} title="Nouveau contrat de bail" description="Le contrat PDF intègre propriétaire, gestionnaire, locataire, logement, loyer, durée et clauses." />
      <Suspense><NewLeaseForm /></Suspense>
    </>
  );
}
