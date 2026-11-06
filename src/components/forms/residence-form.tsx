"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { residenceSchema } from "@/lib/validations";
import { useCrud } from "@/hooks/use-resource";
import { useOptions } from "@/hooks/use-options";
import { useSession } from "@/hooks/use-session";

type In = z.input<typeof residenceSchema>;
type Out = z.output<typeof residenceSchema>;
export type ResidenceRow = { id: string; code: string; name: string; address: string; city: string; commune: string; description: string | null; ownerId: string; managerId: string | null };

export function ResidenceFormDialog({ open, onOpenChange, residence }: { open: boolean; onOpenChange: (o: boolean) => void; residence?: ResidenceRow | null }) {
  const { isAdmin } = useSession();
  const { create, update } = useCrud<Out>("residences");
  const owners = useOptions("owners", "", open);
  const managers = useOptions("managers", "", open && isAdmin);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({ resolver: zodResolver(residenceSchema) });

  useEffect(() => {
    if (open) reset(residence ? { ...residence, description: residence.description ?? "", managerId: residence.managerId ?? "" } : { name: "", address: "", city: "Abidjan", commune: "", description: "", ownerId: "", managerId: "" });
  }, [open, residence, reset]);

  const onSubmit = async (data: Out) => {
    if (residence) await update.mutateAsync({ id: residence.id, data });
    else await create.mutateAsync(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{residence ? "Modifier la résidence" : "Nouvelle résidence"}</DialogTitle>
          <DialogDescription>Une résidence regroupe plusieurs appartements.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Nom de la résidence" required error={errors.name?.message} className="sm:col-span-2"><Input placeholder="Résidence Les Palmiers" {...register("name")} /></FormField>
          <FormField label="Adresse" required error={errors.address?.message} className="sm:col-span-2"><Input {...register("address")} /></FormField>
          <FormField label="Ville" required error={errors.city?.message}><Input {...register("city")} /></FormField>
          <FormField label="Commune" required error={errors.commune?.message}><Input placeholder="Cocody" {...register("commune")} /></FormField>
          <FormField label="Propriétaire" required error={errors.ownerId?.message}>
            <NativeSelect {...register("ownerId")}>
              <option value="">Sélectionner…</option>
              {owners.data?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </NativeSelect>
          </FormField>
          {isAdmin && (
            <FormField label="Gestionnaire attribué">
              <NativeSelect {...register("managerId")}>
                <option value="">Non attribuée</option>
                {managers.data?.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Description" className="sm:col-span-2"><Textarea rows={3} {...register("description")} /></FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" loading={isSubmitting}>{residence ? "Enregistrer" : "Créer la résidence"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
