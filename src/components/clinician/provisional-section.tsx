import Link from "next/link";
import { appointmentTime } from "@/lib/appointments/calendar";
import { GrowthChart } from "@/components/clinical/growth-chart";
import { notFound, redirect } from "next/navigation";
import { UsersRound, Plus, FileClock } from "lucide-react";
import { getProfessional } from "@/lib/auth";
import { ClinicianShell, ClinicianHeading } from "./shell";
import {
  provisionalKinds,
  type ProvisionalChild,
  type ProvisionalEntry,
} from "@/lib/provisional";
import {
  clinicalFieldLabels,
  clinicalValueLabels,
  sourceLabels,
} from "@/lib/clinical/types";
import { uuidPattern } from "@/lib/registry/types";
export type SectionQuery = {
  child?: string;
  q?: string;
  page?: string;
  childPage?: string;
};
const sections = {
  children: {
    title: "Enfants",
    kind: "all",
    description: "Votre registre privé de dossiers provisoires.",
  },
  consultations: {
    title: "Consultations",
    kind: "consultation",
    description: "Historique et saisie de vos consultations provisoires.",
  },
  vaccinations: {
    title: "Vaccinations",
    kind: "vaccination",
    description: "Historique déclaré, sources et suivi vaccinal provisoires.",
  },
  appointments: {
    title: "Rendez-vous",
    kind: "appointment",
    description: "Dates et dispositions enregistrées dans vos dossiers privés.",
  },
  growth: {
    title: "Croissance",
    kind: "growth",
    description:
      "Mesures enregistrées, provenance et historique des corrections.",
  },
} as const;
const name = (c: ProvisionalChild) =>
  [
    c.identity.given_name || "Prénom inconnu",
    c.identity.family_name || "Nom inconnu",
  ].join(" ");
export async function ProvisionalSection({
  section,
  query,
}: {
  section: keyof typeof sections;
  query: SectionQuery;
}) {
  const { profile, supabase } = await getProfessional();
  if (!profile) redirect("/account");
  if (query.child && !uuidPattern.test(query.child)) notFound();
  const config = sections[section],
    base = `/provisional/${section}`,
    page = Math.min(10000, Math.max(1, Math.floor(Number(query.page) || 1))),
    childPage = Math.min(
      10000,
      Math.max(1, Math.floor(Number(query.childPage) || 1)),
    ),
    q = (query.q || "").slice(0, 100);
  const result = await supabase.rpc("provisional_section", {
    p_kind: config.kind,
    p_child_id: query.child || null,
    p_page: page,
    p_query: q,
    p_child_page: childPage,
  });
  if (result.error?.code === "42501") {
    if (query.child) notFound();
    redirect("/account");
  }
  if (result.error)
    throw new Error(
      "Cette rubrique provisoire est temporairement indisponible.",
    );
  const data = result.data as {
    children: ProvisionalChild[];
    children_total: number;
    selected_child: ProvisionalChild | null;
    entries: ProvisionalEntry[];
    total: number;
  };
  const selected = data.selected_child;
  const href = (child: string, n = 1, cp = childPage) =>
    `${base}?${new URLSearchParams({ child, page: String(n), childPage: String(cp), q })}`;
  return (
    <ClinicianShell active={section} provisional profile={profile}>
      <ClinicianHeading title={config.title} description={config.description}>
        <Link className="button primary" href="/provisional?new=1#new-child">
          <Plus size={18} aria-hidden="true" />
          Ajouter un enfant
        </Link>
        {selected && section !== "children" && (
          <Link
            className="button secondary"
            href={`/provisional/${selected.id}?kind=${config.kind}#entry-form`}
          >
            {section === "consultations"
              ? "Nouvelle consultation"
              : section === "vaccinations"
                ? "Enregistrer une vaccination"
                : section === "appointments"
                  ? "Nouveau rendez-vous"
                  : "Nouvelle mesure"}
          </Link>
        )}
      </ClinicianHeading>
      <div className="soignant-attention">
        <strong>Dossiers non vérifiés — privés à leur auteur.</strong>{" "}
        L’approbation du compte ne valide ni ne publie ces entrées.
      </div>
      <form action={base} className="registry-filters panel">
        <label>
          Rechercher dans mes dossiers privés
          <input type="search" name="q" maxLength={100} defaultValue={q} />
        </label>
        <button className="button secondary">Rechercher</button>
        {q && <Link href={base}>Réinitialiser</Link>}
      </form>
      {section === "children" ? (
        <section className="panel">
          <h2>Mes enfants provisoires ({data.children_total})</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Enfant</th>
                  <th>Naissance déclarée</th>
                  <th>Référence locale</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {data.children.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="text-link" href={`/provisional/${c.id}`}>
                        {name(c)}
                      </Link>
                    </td>
                    <td>{c.identity.birth_date || "Date inconnue"}</td>
                    <td>{c.identity.local_reference || "Non renseignée"}</td>
                    <td>Provisoire · non vérifié</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.children.length && (
            <p className="empty-state">
              Aucun dossier privé ne correspond à votre recherche. Vous pouvez
              créer un dossier provisoire.
            </p>
          )}
        </section>
      ) : (
        <div className="soignant-section-grid">
          <aside className="panel">
            <h2>Sélectionner un enfant</h2>
            <div className="soignant-child-list">
              {data.children.map((c) => (
                <Link
                  key={c.id}
                  href={href(c.id)}
                  aria-current={selected?.id === c.id ? "page" : undefined}
                >
                  <UsersRound size={25} aria-hidden="true" />
                  <span>
                    {name(c)}
                    <small>Dossier privé · non vérifié</small>
                  </span>
                </Link>
              ))}
            </div>
            {!data.children.length && (
              <p>Aucun dossier privé ne correspond à ces critères.</p>
            )}
          </aside>
          <div>
            {selected ? (
              <>
                <section className="panel">
                  <h2>{name(selected)}</h2>
                  <p className="muted">
                    {data.total} entrée(s) de cette rubrique · dernière révision
                    de chaque saisie.
                  </p>
                  <Link
                    className="text-link"
                    href={`/provisional/${selected.id}`}
                  >
                    Ouvrir le dossier et l’historique complet
                  </Link>
                </section>
                {section === "vaccinations" && (
                  <section className="soignant-attention">
                    <h2>Historique et suite du suivi</h2>
                    <p>
                      Une transcription n’est pas une administration confirmée.
                      HB1 : aucun calcul automatique de prochaine dose ni de
                      rattrapage. Aucune référence ni aucun rendez-vous n’est
                      créé par cet enregistrement.
                    </p>
                    <Link
                      className="text-link"
                      href={`/provisional/${selected.id}?kind=appointment#entry-form`}
                    >
                      Noter un suivi choisi manuellement
                    </Link>
                  </section>
                )}
                {section === "growth" && (
                  <div className="soignant-two-column">
                    {[
                      { field: "height_cm", label: "Taille", unit: "cm" },
                      { field: "weight_kg", label: "Poids", unit: "kg" },
                    ].map((config) => (
                      <GrowthChart
                        key={config.field}
                        entries={data.entries.map((e) => ({
                          entry_state: e.entry_state as "active" | "withdrawn",
                          occurrence_precision: e.occurrence_precision,
                          occurred_on: e.occurred_on,
                          payload: e.payload,
                          source_verified: false,
                        }))}
                        {...config}
                      />
                    ))}
                  </div>
                )}
                {section === "growth" && (
                  <p className="notice">
                    Valeurs mesurées uniquement. Aucun percentile, diagnostic ou
                    appréciation de « croissance normale » n’est calculé. Les
                    dates inconnues restent explicites.
                  </p>
                )}
                <section className="panel">
                  <h2>
                    {section === "consultations"
                      ? "Historique des consultations"
                      : section === "vaccinations"
                        ? "Historique des vaccinations"
                        : section === "appointments"
                          ? "Rendez-vous enregistrés"
                          : "Historique des mesures"}
                  </h2>
                  {!data.entries.length && (
                    <p className="empty-state">
                      Aucune entrée de cette rubrique pour cet enfant. Utilisez
                      l’action de saisie pour enregistrer une donnée fictive.
                    </p>
                  )}
                  {data.entries.map((e) => (
                    <article className="panel" key={e.id}>
                      <h3>
                        {
                          provisionalKinds[
                            e.kind as keyof typeof provisionalKinds
                          ]
                        }{" "}
                        · révision {e.revision}
                      </h3>
                      <p className="fine">
                        {e.occurred_on || "Date inconnue"}
                        {e.occurrence_precision === "estimated"
                          ? " (estimée)"
                          : ""}{" "}
                        ·{" "}
                        {e.entry_state === "withdrawn"
                          ? "Entrée retirée"
                          : "Entrée active"}{" "}
                        · Source non vérifiée
                      </p>
                      <dl className="details">
                        {Object.entries(e.payload)
                          .filter(([, v]) => v !== "")
                          .map(([k, v]) => (
                            <div key={k}>
                              <dt>
                                {clinicalFieldLabels[k] ||
                                  (
                                    {
                                      scheduled_for: "Date et heure déclarées",
                                      purpose: "Objet",
                                      status: "Disposition déclarée",
                                      catalog_status: "État du vocabulaire",
                                      catalog_version_id:
                                        "Version du vocabulaire",
                                      dose_code: "Dose déclarée",
                                    } as Record<string, string>
                                  )[k] ||
                                  k}
                              </dt>
                              <dd>
                                {k === "scheduled_for"
                                  ? appointmentTime(String(v))
                                  : k === "catalog_status"
                                    ? (
                                        {
                                          draft: "Brouillon — non validé",
                                          approved:
                                            "Catalogue approuvé — entrée toujours non vérifiée",
                                          retired: "Version retirée",
                                        } as Record<string, string>
                                      )[String(v)] || String(v)
                                    : [
                                          "category",
                                          "severity",
                                          "status",
                                        ].includes(k)
                                      ? (
                                          {
                                            planned: "Planifié",
                                            completed: "Terminé",
                                            missed: "Manqué déclaré",
                                            cancelled: "Annulé",
                                            rescheduled: "Replanifié",
                                          } as Record<string, string>
                                        )[String(v)] ||
                                        clinicalValueLabels[String(v)] ||
                                        String(v)
                                      : String(v)}
                              </dd>
                            </div>
                          ))}
                      </dl>
                      <p className="fine">
                        {sourceLabels[e.source_type] ||
                          (
                            { reported: "Historique rapporté" } as Record<
                              string,
                              string
                            >
                          )[e.source_type] ||
                          e.source_type}{" "}
                        · {e.source_reference || "Source non précisée"}
                      </p>
                      <Link
                        className="text-link"
                        href={`/provisional/${selected.id}?edit=${e.root_id}#entry-form`}
                      >
                        Corriger / consulter les révisions
                      </Link>
                    </article>
                  ))}
                </section>
                <nav
                  className="pagination"
                  aria-label="Historique de cette rubrique"
                >
                  {page > 1 && (
                    <Link href={href(selected.id, page - 1)}>
                      Entrées précédentes
                    </Link>
                  )}
                  <span>Page {page} · 30 entrées par page</span>
                  {page * 30 < data.total && (
                    <Link href={href(selected.id, page + 1)}>
                      Entrées suivantes
                    </Link>
                  )}
                </nav>
              </>
            ) : (
              <section className="panel">
                <FileClock size={36} aria-hidden="true" />
                <h2>Aucun enfant sélectionné</h2>
                <p>
                  Créez un dossier provisoire ou recherchez l’un de vos dossiers
                  privés pour commencer.
                </p>
              </section>
            )}
          </div>
        </div>
      )}
      <nav className="pagination" aria-label="Liste des enfants provisoires">
        {childPage > 1 && (
          <Link
            href={`${base}?${new URLSearchParams({ q, childPage: String(childPage - 1) })}`}
          >
            Enfants précédents
          </Link>
        )}
        <span>
          Liste {childPage} · {data.children_total} dossier(s)
        </span>
        {childPage * 30 < data.children_total && (
          <Link
            href={`${base}?${new URLSearchParams({ q, childPage: String(childPage + 1) })}`}
          >
            Enfants suivants
          </Link>
        )}
      </nav>
    </ClinicianShell>
  );
}
