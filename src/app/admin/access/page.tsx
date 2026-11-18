import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfessional } from "@/lib/auth";
import { AdminHeading, AdminShell } from "@/components/verification/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminAccess({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { profile, supabase } = await getProfessional();
  if (profile?.role !== "admin" || profile.verification_status !== "approved")
    redirect("/account");
  const section =
    (await searchParams).section === "catalog" ? "catalog" : "permissions";
  const catalog = section === "catalog";
  const { data, error } = await supabase.rpc(
    catalog ? "vaccine_catalog_permissions" : "can_manage_clinical_permissions",
  );
  if (error)
    throw new Error(
      "Impossible de vérifier vos autorisations d’administration.",
    );
  const allowed = catalog ? data?.manage === true : data === true;
  if (allowed) redirect(catalog ? "/vaccines" : "/admin/clinical-permissions");
  return (
    <AdminShell active={section}>
      <AdminHeading
        section={section}
        title={catalog ? "Catalogue vaccinal" : "Habilitations cliniques"}
        description="Une autorisation supplémentaire est nécessaire pour cette rubrique."
      />
      <section className="panel">
        <h2>Accès non accordé</h2>
        <p>
          Votre compte administrateur ne dispose pas de l’autorisation de{" "}
          {catalog
            ? "gestion du catalogue vaccinal."
            : "gestion des habilitations cliniques."}
        </p>
        <p className="muted">
          La revue des professionnels et la gestion de cette rubrique sont des
          autorisations distinctes. Contactez le responsable des accès pour
          faire vérifier votre autorisation.
        </p>
        <Link href="/account" className="button secondary">
          Voir mes autorisations
        </Link>
      </section>
    </AdminShell>
  );
}
