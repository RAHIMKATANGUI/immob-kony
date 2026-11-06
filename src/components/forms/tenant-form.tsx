"use client";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Building2, DoorOpen, FileUp } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/ui/form-field";
import { Section } from "@/components/shared/info";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { tenantSchema } from "@/lib/validations";
import { apiPatch, apiPost, HttpError, uploadFile } from "@/lib/api-client";
import { useOptions } from "@/hooks/use-options";
import { ID_TYPES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useState } from "react";

type In = z.input<typeof tenantSchema>;
type Out = z.output<typeof tenantSchema>;

export function TenantForm({ tenant }: { tenant?: (Out & { id: string }) | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"apartment" | "residence">(tenant && !tenant.apartmentId ? "residence" : "apartment");
  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({
    resolver: zodResolver(tenantSchema),
    defaultValues: tenant
      ? { ...tenant, email: tenant.email ?? "", profession: tenant.profession ?? "", exitDate: tenant.exitDate?.slice(0, 10) ?? "", entryDate: tenant.entryDate.slice(0, 10), apartmentId: tenant.apartmentId ?? "" }
      : { firstName: "", lastName: "", phone: "", email: "", profession: "", idType: "CNI", idNumber: "", entryDate: new Date().toISOString().slice(0, 10), exitDate: "", adults: 1, children: 0, residenceId: "", apartmentId: "", photoUrl: null, idDocumentUrl: null },
  });
  const [residenceId, adults, children, photoUrl, idDocumentUrl] = useWatch({ control, name: ["residenceId", "adults", "children", "photoUrl", "idDocumentUrl"] });
  const residences = useOptions("residences");
  const apartments = useOptions("apartments", `&residenceId=${residenceId}`, !!residenceId);

  const onSubmit = async (data: Out) => {
    const payload = { ...data, apartmentId: mode === "residence" ? null : data.apartmentId };
    try {
      const res = tenant ? await apiPatch<{ id: string }>(`/api/tenants/${tenant.id}`, payload) : await apiPost<{ id: string }>("/api/tenants", payload);
      await qc.invalidateQueries();
      toast.success(tenant ? "Locataire mis à jour" : "Locataire ajouté");
      router.push(`/tenants/${res.id}`);
    } catch (e) {
      toast.error(e instanceof HttpError ? e.message : "Erreur");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-3" noValidate>
      <div className="space-y-4 lg:col-span-2">
        <Section title="Identité">
          <div className="mb-5"><PhotoUpload value={photoUrl} onChange={(u) => setValue("photoUrl", u)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Prénom" required error={errors.firstName?.message}><Input {...register("firstName")} /></FormField>
            <FormField label="Nom" required error={errors.lastName?.message}><Input {...register("lastName")} /></FormField>
            <FormField label="Téléphone" required error={errors.phone?.message}><Input type="tel" {...register("phone")} /></FormField>
            <FormField label="Email" error={errors.email?.message} hint="Utilisé pour les reçus et relances"><Input type="email" {...register("email")} /></FormField>
            <FormField label="Profession"><Input {...register("profession")} /></FormField>
            <FormField label="Type de pièce d'identité">
              <NativeSelect {...register("idType")}>{Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
            </FormField>
            <FormField label="N° de pièce d'identité" required error={errors.idNumber?.message}><Input {...register("idNumber")} /></FormField>
            <FormField label="Scan de la pièce">
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 text-sm text-muted-foreground transition hover:border-brand">
                <FileUp className="size-4" /> {idDocumentUrl ? "Document téléversé ✓" : "Téléverser (PDF / image)"}
                <input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try { const { url } = await uploadFile(f, "documents"); setValue("idDocumentUrl", url); toast.success("Document ajouté"); } catch (err) { toast.error(err instanceof HttpError ? err.message : "Échec"); }
                }} />
              </label>
            </FormField>
          </div>
        </Section>
        <Section title="Logement" description="Rattachez le locataire à un appartement précis ou à la résidence.">
          <div className="mb-4 grid grid-cols-2 gap-2">
            {([["apartment", "Un appartement", DoorOpen], ["residence", "La résidence", Building2]] as const).map(([k, l, I]) => (
              <button type="button" key={k} onClick={() => setMode(k)} className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition", mode === k ? "border-brand bg-accent text-accent-foreground" : "hover:bg-muted")}>
                <I className="size-4" /> {l}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Résidence" required error={errors.residenceId?.message}>
              <NativeSelect {...register("residenceId", { onChange: () => setValue("apartmentId", "") })}>
                <option value="">Sélectionner…</option>
                {residences.data?.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </NativeSelect>
            </FormField>
            {mode === "apartment" && (
              <FormField label="Appartement" error={errors.apartmentId?.message}>
                <NativeSelect {...register("apartmentId")} disabled={!residenceId}>
                  <option value="">Sélectionner…</option>
                  {apartments.data?.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </NativeSelect>
              </FormField>
            )}
          </div>
        </Section>
      </div>
      <div className="space-y-4">
        <Section title="Occupation">
          <div className="grid gap-4">
            <FormField label="Date d'entrée" required error={errors.entryDate?.message}><Input type="date" {...register("entryDate")} /></FormField>
            <FormField label="Date de sortie" error={errors.exitDate?.message}><Input type="date" {...register("exitDate")} /></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Adultes" error={errors.adults?.message}><Input type="number" min={1} {...register("adults")} /></FormField>
              <FormField label="Enfants" error={errors.children?.message}><Input type="number" min={0} {...register("children")} /></FormField>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-accent-foreground">
              <span className="text-sm font-medium">Total occupants</span>
              <span className="font-display text-2xl font-bold">{(Number(adults) || 0) + (Number(children) || 0)}</span>
            </div>
          </div>
        </Section>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>Annuler</Button>
          <Button type="submit" variant="brand" className="flex-1" loading={isSubmitting}>{tenant ? "Enregistrer" : "Créer le locataire"}</Button>
        </div>
      </div>
    </form>
  );
}
