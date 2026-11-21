import type { VaccineChoice } from "@/lib/vaccines/choices";
import { clinicalFieldLabels, clinicalValueLabels } from "@/lib/clinical/types";
import Link from "next/link";
import { ChildAvatar } from "@/components/clinician/child-avatar";
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
  const vocabulary = await supabase.rpc("vaccine_form_choices");
  if (vocabulary.error)
    throw new Error("Choix vaccinaux indisponibles. Rechargez la page.");
  const entryForm = (
    <section className="panel" id="entry-form">
      <h2>{editing ? "Corriger une entrée" : "Ajouter une entrée"}</h2>
      {editing && (
        <Link href={`/provisional/${id}`}>Annuler la correction</Link>
      )}
      <ProvisionalEntryForm
        key={editing?.id ?? "new"}
        childId={id}
        operationId={randomUUID()}
        entry={editing}
        vaccineChoices={vocabulary.data as VaccineChoice[]}
        initialKind={
          q.kind && Object.hasOwn(provisionalKinds, q.kind)
            ? (q.kind as keyof typeof provisionalKinds)
            : undefined
        }
      />
    </section>
  );
  const historySection = (
    <section className="panel" id="entry-history">
      <h2>Historique immuable ({result.total} révisions)</h2>
      {!result.entries.length && (
        <p>
          Aucune entrée enregistrée sur cette page. Utilisez le formulaire
          ci-dessous pour une nouvelle saisie.
        </p>
      )}
      <div className="record-list">
        {result.entries.map((e) => (
          <article key={e.id}>
            <h3>
              {provisionalKinds[e.kind as keyof typeof provisionalKinds]} ·
              Révision {e.revision}
            </h3>
            <p>
              Non vérifié · {e.entry_state} · {e.occurred_on || "Date inconnue"}{" "}
              ({e.occurrence_precision})
            </p>
            <dl className="details">
              {Object.entries(e.payload).map(([k, v]) => (
                <div key={k}>
                  <dt>
                    {(
                      {
                        catalog_version_id: "Version du vocabulaire",
                        catalog_status: "État du catalogue",
                        dose_code: "Code de dose déclaré",
                      } as Record<string, string>
                    )[k] ||
                      clinicalFieldLabels[k] ||
                      k}
                  </dt>
                  <dd>
                    {k === "catalog_status"
                      ? (
                          {
                            draft: "Brouillon — non validé",
                            approved: "Approuvé (vocabulaire seulement)",
                            retired: "Version retirée",
                          } as Record<string, string>
                        )[String(v)] || String(v)
                      : ["category", "severity", "status"].includes(k)
                        ? clinicalValueLabels[String(v)] || String(v)
                        : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Source : {e.source_type} · {e.source_reference || "Non précisée"}
            </p>
            <p>
              Auteur : {e.owner_id} ({e.author_role}), compte {e.account_status}{" "}
              · {e.recorded_at}
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
  );
  return (
    <main className="workspace">
      <ProvisionalHeader profile={profile} />
      <section className="page-heading">
        <h1 id="main-content" className="clinician-child-label" tabIndex={-1}>
          <ChildAvatar sex={result.child.identity.sex} />
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
      <section className="panel" aria-labelledby="provisional-followup-title">
        <h2 id="provisional-followup-title">
          Historique enregistré et suite du suivi
        </h2>
        <p>
          Les entrées de ce dossier restent non vérifiées. Leur enregistrement
          ne crée ni référence vaccinale validée ni prochain rendez-vous.
        </p>
        <p>
          Une HB1 déclarée ne masque pas les autres repères de routine. Pour une
          HB1 non administrée, incertaine ou un rattrapage, le professionnel
          examine l’historique et décide du suivi manuellement.
        </p>
        <div className="tabs">
          <Link href={`/provisional/vaccinations?child=${id}#routine-followup`}>
            Vaccinations à venir et suivis planifiés
          </Link>
          <Link href="#entry-history">Consulter les entrées enregistrées</Link>
          <Link href="?kind=vaccination#entry-form">
            Noter une vaccination / un historique
          </Link>
          <Link href="?kind=appointment#entry-form">
            Noter un rendez-vous provisoire
          </Link>
        </div>
        <p className="fine">
          Un rendez-vous provisoire reste privé à son auteur ; il ne confirme
          aucune administration et n’est pas publié dans un carnet partagé.
        </p>
      </section>
      {editing && entryForm}
      {historySection}
      {!editing && entryForm}
    </main>
  );
}
