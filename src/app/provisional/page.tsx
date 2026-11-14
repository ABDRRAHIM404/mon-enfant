import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getProfessional } from "@/lib/auth";
import { ProvisionalHeader } from "@/components/provisional/header";
import { ProvisionalChildForm } from "@/components/provisional/forms";
import type { ProvisionalChild } from "@/lib/provisional";
export const dynamic = "force-dynamic";
export default async function ProvisionalWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { profile, supabase } = await getProfessional();
  if (!profile) redirect("/account");
  const page = Math.max(
    1,
    Math.min(10000, Number((await searchParams).page) || 1),
  );
  const { data, error } = await supabase.rpc("provisional_workspace", {
    p_page: page,
  });
  if (error?.code === "42501") redirect("/account");
  if (error) throw new Error("Espace provisoire indisponible.");
  const result = data as { items: ProvisionalChild[]; total: number };
  return (
    <main className="workspace">
      <ProvisionalHeader profile={profile} />
      <section className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Mes dossiers provisoires
        </h1>
        <p>
          Aucun accès aux dossiers d’autres soignants. Pour consulter un carnet
          partagé, votre compte doit être vérifié et recevoir une autorisation
          distincte.
        </p>
      </section>
      <section className="panel">
        <h2>Créer un enfant</h2>
        <ProvisionalChildForm operationId={randomUUID()} />
      </section>
      <section className="panel">
        <h2>Mes enfants ({result.total})</h2>
        <div className="record-list">
          {result.items.map((child) => (
            <article key={child.id}>
              <Link href={`/provisional/${child.id}`}>
                {child.identity.given_name || "Prénom inconnu"}{" "}
                {child.identity.family_name || "Nom inconnu"}
              </Link>
              <p>
                Non vérifié · Naissance :{" "}
                {child.identity.birth_date || "Inconnue"}
              </p>
            </article>
          ))}
          {!result.items.length && <p>Aucun dossier créé.</p>}
        </div>
        <div className="pagination">
          {page > 1 && <Link href={`?page=${page - 1}`}>← Précédent</Link>}
          {result.total > page * 30 && (
            <Link href={`?page=${page + 1}`}>Suivant →</Link>
          )}
        </div>
      </section>
    </main>
  );
}
