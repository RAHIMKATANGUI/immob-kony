import { PageHeader } from "@/components/shared/page-header";
import { TenantForm } from "@/components/forms/tenant-form";

export const metadata = { title: "Nouveau locataire" };

export default function NewTenantPage() {
  return (
    <>
      <PageHeader back={{ href: "/tenants", label: "Locataires" }} title="Nouveau locataire" description="Identité, logement et composition du foyer" />
      <TenantForm />
    </>
  );
}
