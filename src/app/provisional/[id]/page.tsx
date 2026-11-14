import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect, notFound } from "next/navigation";
import { getProfessional } from "@/lib/auth";
import { ProvisionalHeader } from "@/components/provisional/header";
import { ProvisionalEntryForm } from "@/components/provisional/forms";
import {
  provisionalKinds,
  type ProvisionalChild,
  type ProvisionalEntry,
} from "@/lib/provisional";
export const dynamic = "force-dynamic";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export default async function ProvisionalBooklet({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; edit?: string; kind?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  if (!uuid.test(id)) notFound();
  const { profile, supabase } = await getProfessional();
  if (!profile) redirect("/account");
  const page = Math.max(1, Math.min(10000, Number(q.page) || 1));
  const { data, error } = await supabase.rpc("provisional_booklet", {
    p_child_id: id,
    p_page: page,
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Dossier provisoire indisponible.");
  const result = data as {
    child: ProvisionalChild;
    entries: ProvisionalEntry[];
    total: number;
  };
  let editing: ProvisionalEntry | undefined;
  if (q.edit && uuid.test(q.edit)) {
    const current = await supabase.rpc("provisional_booklet", {
      p_child_id: id,
      p_page: 1,
      p_root_id: q.edit,
    });
    if (current.error) notFound();
    editing = (current.data as { entries: ProvisionalEntry[] }).entries[0];
    if (!editing) notFound();
  }
  return (
    <main className="workspace">
      <ProvisionalHeader profile={profile} />
      <section className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          {result.child.identity.given_name || "Prénom inconnu"}{" "}
          {result.child.identity.family_name || "Nom inconnu"}
        </h1>
        <p>Identifiant interne permanent : {result.child.id}</p>
        <p>
          Naissance : {result.child.identity.birth_date || "Inconnue"} ·{" "}
          {result.child.identity.birth_date_precision} · Sexe :{" "}
          {result.child.identity.sex}
        </p>
        <p>
          Créé le {result.child.created_at} par {result.child.owner_id} (
          {result.child.author_role}), compte {result.child.account_status}.
          Dossier toujours non vérifié.
        </p>
        <p>
          Aucun QR de partage, aucune importation ni publication de ce dossier.
        </p>
      </section>
      <section className="panel">
        <h2>{editing ? "Corriger une entrée" : "Ajouter une entrée"}</h2>
        {editing && (
          <Link href={`/provisional/${id}`}>Annuler la correction</Link>
        )}
        <ProvisionalEntryForm
          key={editing?.id ?? "new"}
          childId={id}
          operationId={randomUUID()}
          entry={editing}
          initialKind={
            q.kind && Object.hasOwn(provisionalKinds, q.kind)
              ? (q.kind as keyof typeof provisionalKinds)
              : undefined
          }
        />
      </section>
      <section className="panel">
        <h2>Historique immuable ({result.total} révisions)</h2>
        <div className="record-list">
          {result.entries.map((e) => (
            <article key={e.id}>
              <h3>
                {provisionalKinds[e.kind as keyof typeof provisionalKinds]} ·
                Révision {e.revision}
              </h3>
              <p>
                Non vérifié · {e.entry_state} ·{" "}
                {e.occurred_on || "Date inconnue"} ({e.occurrence_precision})
              </p>
              <dl>
                {Object.entries(e.payload).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Source : {e.source_type} ·{" "}
                {e.source_reference || "Non précisée"}
              </p>
              <p>
                Auteur : {e.owner_id} ({e.author_role}), compte{" "}
                {e.account_status} · {e.recorded_at}
              </p>
              {e.reason && <p>Motif : {e.reason}</p>}
              <Link href={`?edit=${e.root_id}`}>Corriger / changer l’état</Link>
            </article>
          ))}
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
