"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportMenu } from "@/components/shared/export-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OwnerFormDialog, type OwnerRow } from "@/components/forms/owner-form";
import { useCrud, useList } from "@/hooks/use-resource";
import { useDebounce } from "@/hooks/use-debounce";
import { useSession } from "@/hooks/use-session";
import { formatDate, initials } from "@/lib/utils";

type Row = OwnerRow & { _count: { residences: number } };

export default function OwnersPage() {
  const router = useRouter();
  const { isAdmin } = useSession();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Row | null>(null);
  const dq = useDebounce(q);
  const { data, isLoading } = useList<Row>("owners", { q: dq, page });
  const { remove } = useCrud("owners");

  return (
    <>
      <PageHeader
        title="Propriétaires"
        description="Bailleurs des résidences gérées"
        actions={<><ExportMenu entity="owners" /><Button onClick={() => { setEdit(null); setOpen(true); }}><Plus /> Ajouter</Button></>}
      />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r) => router.push(`/owners/${r.id}`)}
        columns={[
          {
            key: "name", header: "Propriétaire", cell: (r) => (
              <div className="flex items-center gap-3">
                <Avatar className="size-9"><AvatarFallback>{initials(r.firstName, r.lastName)}</AvatarFallback></Avatar>
                <div><p className="font-medium">{r.firstName} {r.lastName}</p><p className="text-xs text-muted-foreground">{r.code}</p></div>
              </div>
            ),
          },
          { key: "phone", header: "Téléphone", cell: (r) => r.phone },
          { key: "email", header: "Email", cell: (r) => r.email ?? "—", hideOnMobile: true },
          { key: "res", header: "Résidences", cell: (r) => <span className="font-semibold tabular-nums">{r._count.residences}</span>, hideOnMobile: true },
          { key: "created", header: "Créé le", cell: (r) => formatDate(r.createdAt), hideOnMobile: true },
          {
            key: "actions", header: "", className: "w-10", cell: (r) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon" className="size-8"><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => router.push(`/owners/${r.id}`)}><Eye /> Voir l'historique</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setEdit(r); setOpen(true); }}><Pencil /> Modifier</DropdownMenuItem>
                  {isAdmin && <DropdownMenuItem destructive onClick={() => setDel(r)}><Trash2 /> Supprimer</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />
      <OwnerFormDialog open={open} onOpenChange={setOpen} owner={edit} />
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Supprimer ce propriétaire ?"
        description={`${del?.firstName} ${del?.lastName} sera archivé. Son historique reste consultable dans le journal d'audit.`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => setDel(null) })}
      />
    </>
  );
}
