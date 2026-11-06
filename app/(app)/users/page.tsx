"use client";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { Pencil, Plus, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/ui/form-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { useOptions } from "@/hooks/use-options";
import { onError } from "@/hooks/use-resource";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { z as zod } from "zod";
import { passwordSchema, userCreateSchema } from "@/lib/validations";
import { formatDate, initials } from "@/lib/utils";
import { ROLES } from "@/lib/labels";

type U = { id: string; email: string; role: keyof typeof ROLES; firstName: string; lastName: string; phone: string | null; isActive: boolean; lastLoginAt: string | null; manager: { id: string; address: string; residences: { id: string; name: string }[] } | null };
type In = z.input<typeof userCreateSchema>;
type Out = z.output<typeof userCreateSchema>;
const editSchema = userCreateSchema.extend({ password: passwordSchema.or(zod.literal("")) });

function UserDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user: U | null }) {
  const qc = useQueryClient();
  const residences = useOptions("residences", "", open);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({ resolver: zodResolver(user ? (editSchema as unknown as typeof userCreateSchema) : userCreateSchema) });
  const selected = watch("residenceIds") ?? [];
  useEffect(() => {
    if (open) reset(user ? { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? "", address: user.manager?.address ?? "", role: user.role, password: "", residenceIds: user.manager?.residences.map((r) => r.id) ?? [] } : { firstName: "", lastName: "", email: "", phone: "", address: "", role: "MANAGER", password: "", residenceIds: [] });
  }, [open, user, reset]);
  const save = useMutation({
    mutationFn: (d: Out) => (user ? apiPatch(`/api/users/${user.id}`, d) : apiPost("/api/users", d)),
    onSuccess: () => { toast.success(user ? "Utilisateur mis à jour" : "Gestionnaire créé"); qc.invalidateQueries(); onOpenChange(false); },
    onError,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{user ? "Modifier l'utilisateur" : "Nouveau gestionnaire"}</DialogTitle><DialogDescription>Un gestionnaire ne voit que les résidences qui lui sont attribuées.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Prénom" required error={errors.firstName?.message}><Input {...register("firstName")} /></FormField>
          <FormField label="Nom" required error={errors.lastName?.message}><Input {...register("lastName")} /></FormField>
          <FormField label="Email" required error={errors.email?.message}><Input type="email" {...register("email")} /></FormField>
          <FormField label="Téléphone" required error={errors.phone?.message}><Input {...register("phone")} /></FormField>
          <FormField label="Adresse" required error={errors.address?.message}><Input {...register("address")} /></FormField>
          <FormField label="Rôle"><NativeSelect {...register("role")}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></FormField>
          <FormField label={user ? "Nouveau mot de passe" : "Mot de passe"} required={!user} error={errors.password?.message} hint="10 caractères min., majuscule, minuscule, chiffre" className="sm:col-span-2"><Input type="password" autoComplete="new-password" {...register("password")} /></FormField>
          <div className="sm:col-span-2">
            <p className="mb-2 text-[13px] font-medium">Résidences attribuées</p>
            <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {residences.data?.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-accent">
                  <input type="checkbox" className="accent-[hsl(var(--brand))]" checked={selected.includes(r.id)} onChange={(e) => setValue("residenceIds", e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))} />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" loading={isSubmitting || save.isPending}>Enregistrer</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { isAdmin, sub } = useSession();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<{ items: U[] }>("/api/users"), enabled: isAdmin });
  const [edit, setEdit] = useState<U | null>(null);
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState<U | null>(null);
  const disable = useMutation({ mutationFn: (id: string) => apiDelete(`/api/users/${id}`), onSuccess: () => { toast.success("Compte désactivé"); qc.invalidateQueries({ queryKey: ["users"] }); setOff(null); }, onError });

  if (!isAdmin) redirect("/dashboard");
  return (
    <>
      <PageHeader title="Utilisateurs" description="Super administrateurs et gestionnaires — attribution des résidences (RBAC)" actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus /> Nouveau gestionnaire</Button>} />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          { key: "u", header: "Utilisateur", cell: (u) => <div className="flex items-center gap-3"><Avatar><AvatarFallback>{initials(u.firstName, u.lastName)}</AvatarFallback></Avatar><div><p className="font-medium">{u.firstName} {u.lastName}</p><p className="text-xs text-muted-foreground">{u.email}</p></div></div> },
          { key: "role", header: "Rôle", cell: (u) => <Badge variant={u.role === "SUPER_ADMIN" ? "info" : "muted"}>{u.role === "SUPER_ADMIN" && <ShieldCheck className="size-3" />}{ROLES[u.role]}</Badge> },
          { key: "res", header: "Résidences", cell: (u) => <div className="flex max-w-xs flex-wrap gap-1">{u.role === "SUPER_ADMIN" ? <span className="text-xs text-muted-foreground">Toutes</span> : u.manager?.residences.map((r) => <Badge key={r.id} variant="default">{r.name}</Badge>)}</div>, hideOnMobile: true },
          { key: "last", header: "Dernière connexion", cell: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt, { hour: "2-digit", minute: "2-digit", timeZone: undefined }) : "Jamais"), hideOnMobile: true },
          { key: "state", header: "État", cell: (u) => (u.isActive ? <Badge variant="success" dot>Actif</Badge> : <Badge variant="muted">Désactivé</Badge>) },
          { key: "a", header: "", cell: (u) => <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="size-8" onClick={() => { setEdit(u); setOpen(true); }} aria-label="Modifier"><Pencil /></Button>{u.id !== sub && u.isActive && <Button variant="ghost" size="icon" className="size-8" onClick={() => setOff(u)} aria-label="Désactiver"><UserX /></Button>}</div> },
        ]}
      />
      <UserDialog open={open} onOpenChange={setOpen} user={edit} />
      <ConfirmDialog open={!!off} onOpenChange={(o) => !o && setOff(null)} title="Désactiver ce compte ?" description="L'utilisateur ne pourra plus se connecter et ses résidences seront libérées." confirmLabel="Désactiver" loading={disable.isPending} onConfirm={() => off && disable.mutate(off.id)} />
    </>
  );
}
