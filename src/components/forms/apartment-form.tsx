"use client";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apartmentSchema } from "@/lib/validations";
import { useCrud } from "@/hooks/use-resource";
import { useOptions } from "@/hooks/use-options";
import { APARTMENT_STATUS, ROOM_TYPES } from "@/lib/labels";

type In = z.input<typeof apartmentSchema>;
type Out = z.output<typeof apartmentSchema>;
export type ApartmentRow = { id: string; residenceId: string; number: string; floor: number; surface: string; roomsCount: number; status: keyof typeof APARTMENT_STATUS; baseRent: string; description: string | null };

const DEFAULT_ROOMS: In["rooms"] = [
  { type: "LIVING_ROOM", label: "Salon" },
  { type: "BEDROOM", label: "Chambre 1" },
  { type: "KITCHEN", label: "Cuisine" },
  { type: "SHOWER", label: "Douche" },
  { type: "TOILET", label: "Toilette" },
];

export function ApartmentFormDialog({ open, onOpenChange, apartment, residenceId }: { open: boolean; onOpenChange: (o: boolean) => void; apartment?: ApartmentRow | null; residenceId?: string }) {
  const { create, update } = useCrud<Out>("apartments", ["residences"]);
  const residences = useOptions("residences", "", open);
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({ resolver: zodResolver(apartmentSchema) });
  const rooms = useFieldArray({ control, name: "rooms" });

  useEffect(() => {
    if (!open) return;
    reset(
      apartment
        ? { ...apartment, surface: Number(apartment.surface), baseRent: Number(apartment.baseRent), description: apartment.description ?? "" }
        : { residenceId: residenceId ?? "", number: "", floor: 0, surface: 0, roomsCount: 2, status: "AVAILABLE", baseRent: 0, description: "", rooms: DEFAULT_ROOMS },
    );
  }, [open, apartment, residenceId, reset]);

  const onSubmit = async (data: Out) => {
    if (apartment) await update.mutateAsync({ id: apartment.id, data: { ...data, rooms: undefined } });
    else await create.mutateAsync(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{apartment ? `Modifier l'appartement ${apartment.number}` : "Nouvel appartement"}</DialogTitle>
          <DialogDescription>Caractéristiques, statut et détail des pièces.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-3" noValidate>
          <FormField label="Résidence" required error={errors.residenceId?.message} className="sm:col-span-2">
            <NativeSelect {...register("residenceId")} disabled={!!apartment}>
              <option value="">Sélectionner…</option>
              {residences.data?.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </NativeSelect>
          </FormField>
          <FormField label="Numéro" required error={errors.number?.message}><Input placeholder="A1" {...register("number")} /></FormField>
          <FormField label="Étage" error={errors.floor?.message}><Input type="number" {...register("floor")} /></FormField>
          <FormField label="Surface (m²)" required error={errors.surface?.message}><Input type="number" step="0.01" {...register("surface")} /></FormField>
          <FormField label="Nombre de pièces" required error={errors.roomsCount?.message}><Input type="number" {...register("roomsCount")} /></FormField>
          <FormField label="Statut">
            <NativeSelect {...register("status")}>
              {Object.entries(APARTMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </FormField>
          <FormField label="Loyer de référence" error={errors.baseRent?.message} className="sm:col-span-2"><Input type="number" step="1000" {...register("baseRent")} /></FormField>
          <FormField label="Description" className="sm:col-span-3"><Input {...register("description")} /></FormField>

          {!apartment && (
            <div className="sm:col-span-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Détail des pièces</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => rooms.append({ type: "BEDROOM", label: "" })}><Plus /> Ajouter une pièce</Button>
              </div>
              <div className="space-y-2">
                {rooms.fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[1fr_1fr_90px_36px] gap-2">
                    <NativeSelect {...register(`rooms.${i}.type`)}>
                      {Object.entries(ROOM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                    <Input placeholder="Libellé" {...register(`rooms.${i}.label`)} />
                    <Input type="number" placeholder="m²" {...register(`rooms.${i}.surface`)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => rooms.remove(i)} aria-label="Retirer"><Trash2 /></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="sm:col-span-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" loading={isSubmitting}>{apartment ? "Enregistrer" : "Créer l'appartement"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
