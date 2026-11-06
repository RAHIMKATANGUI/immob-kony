"use client";
import { use } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TenantForm } from "@/components/forms/tenant-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useItem } from "@/hooks/use-resource";

export default function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = useItem<{ tenant: Parameters<typeof TenantForm>[0]["tenant"] & { firstName: string; lastName: string } }>("tenants", id);
  if (!data) return <Skeleton className="h-96 rounded-2xl" />;
  return (
    <>
      <PageHeader back={{ href: `/tenants/${id}`, label: "Fiche locataire" }} title={`Modifier ${data.tenant.firstName} ${data.tenant.lastName}`} />
      <TenantForm tenant={data.tenant} />
    </>
  );
}
