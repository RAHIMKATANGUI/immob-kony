"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ownerSchema } from "@/lib/validations";
import { useCrud } from "@/hooks/use-resource";

type In = z.input<typeof ownerSchema>;
type Out = z.output<typeof ownerSchema>;
export type OwnerRow = { id: string; code: string; firstName: string; lastName: string; phone: string; email: string | null; address: string; notes: string | null; createdAt: string };

export function OwnerFormDialog({ open, onOpenChange, owner }: { open: boolean; onOpenChange: (o: boolean) => void; owner?: OwnerRow | null }) {
  const { create, update } = useCrud<Out>("owners");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({ resolver: zodResolver(ownerSchema) });

  useEffect(() => {
    if (open) reset(owner ? { ...owner, email: owner.email ?? "", notes: owner.notes ?? "" } : { firstName: "", lastName: "", phone: "", email: "", address: "", notes: "" });
  }, [open, owner, reset]);

  const onSubmit = async (data: Out) => {
    if (owner) await update.mutateAsync({ id: owner.id, data });
    else await create.mutateAsync(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{owner ? "Modifier le propriétaire" : "Ajouter un propriétaire"}</DialogTitle>
          <DialogDescription>{owner ? owner.code : "Un identifiant unique sera généré automatiquement."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Prénom" required error={errors.firstName?.message}><Input {...register("firstName")} /></FormField>
          <FormField label="Nom" required error={errors.lastName?.message}><Input {...register("lastName")} /></FormField>
          <FormField label="Téléphone" required error={errors.phone?.message}><Input type="tel" {...register("phone")} /></FormField>
          <FormField label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></FormField>
          <FormField label="Adresse" required error={errors.address?.message} className="sm:col-span-2"><Input {...register("address")} /></FormField>
          <FormField label="Notes" className="sm:col-span-2"><Textarea rows={3} {...register("notes")} /></FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" loading={isSubmitting}>{owner ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
