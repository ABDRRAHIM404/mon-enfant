import Link from "next/link";
import {
  clinicalChildHref,
  clinicalDestination,
  clinicalDestinationLabel,
} from "./clinical-destinations";
import { appointmentTime } from "@/lib/appointments/calendar";
import { GrowthChart } from "@/components/clinical/growth-chart";
import { notFound, redirect } from "next/navigation";
import { Plus, FileClock } from "lucide-react";
import { ChildAvatar } from "./child-avatar";
import { ClinicianChildPicker } from "./child-picker";
import { ProvisionalVaccinationFollowup } from "./provisional-vaccination-followup";
import type { ProvisionalFollowup } from "@/lib/vaccines/provisional-followup";
import { getProfessional } from "@/lib/auth";
import { ClinicianHeading } from "./shell";
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
  open?: string;
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
  childId,
}: {
  section: keyof typeof sections;
  query: SectionQuery;
  childId?: string;
}) {
  const { profile, supabase } = await getProfessional();
  if (!profile) redirect("/account");
  const requestedChild =
    childId || (section === "appointments" ? query.child : undefined);
  if (requestedChild && !uuidPattern.test(requestedChild)) notFound();
  const open =
    section === "children" ? clinicalDestination(query.open) : undefined;
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
    p_child_id: requestedChild || null,
    p_page: page,
    p_query: q,
    p_child_page: childPage,
  });
  if (result.error?.code === "42501") {
    if (requestedChild) notFound();
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
  if (childId && selected?.id !== childId) notFound();
  const followup =
    selected && section === "vaccinations"
      ? await supabase.rpc("provisional_vaccination_followup", {
          p_child_id: selected.id,
        })
      : null;
  if (followup?.error?.code === "42501") notFound();
  const href = (child: string, n = 1, cp = childPage) => {
    const params = new URLSearchParams({ page: String(n) });
    if (childId) return `/provisional/${childId}/${section}?${params}`;
    if (open) params.set("open", open);
    if (child) params.set("child", child);
    params.set("childPage", String(cp));
    if (q) params.set("q", q);
    return `${base}?${params}`;
  };
  return (
    <>
      <ClinicianHeading
        title={config.title}
        description={
          open
            ? `Sélectionnez un dossier privé pour ouvrir « ${clinicalDestinationLabel(open)} ».`
            : config.description
        }
      >
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
      {section === "children" && (
        <form action={base} className="registry-filters panel">
          {open && <input type="hidden" name="open" value={open} />}
          <label>
            Rechercher dans mes dossiers privés
            <input type="search" name="q" maxLength={100} defaultValue={q} />
          </label>
          <button className="button secondary">Rechercher</button>
          {q && (
            <Link href={open ? `${base}?open=${open}` : base}>
              Réinitialiser
            </Link>
          )}
        </form>
      )}
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
                      <Link
                        className="text-link clinician-child-label"
                        href={
                          open
                            ? clinicalChildHref(c.id, open, true)
                            : `/provisional/${c.id}`
                        }
                      >
                        <ChildAvatar sex={c.identity.sex} size={34} />
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
        <div className={childId ? undefined : "soignant-section-grid"}>
          {!childId && (
            <ClinicianChildPicker
              base={base}
              q={q}
              page={childPage}
              total={data.children_total}
              items={data.children.map((c) => ({
                id: c.id,
                label: name(c),
                sex: c.identity.sex,
                caption: "Dossier privé · non vérifié",
              }))}
              current={
                selected ? { id: selected.id, label: name(selected) } : null
              }
              privateRecords
            />
          )}
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
                {section === "vaccinations" &&
                  (followup?.data && !followup.error ? (
                    <ProvisionalVaccinationFollowup
                      data={followup.data as ProvisionalFollowup}
                      childId={selected.id}
                      identity={selected.identity}
                    />
                  ) : (
                    <section className="panel">
                      <h2>Vaccinations à venir</h2>
                      <p role="status">
                        Le calendrier est temporairement indisponible.
                        L’historique enregistré ci-dessous est conservé.
                      </p>
                      <Link
                        className="text-link"
                        href={`/provisional/${selected.id}?kind=appointment#entry-form`}
                      >
                        Planifier un suivi manuellement
                      </Link>
                    </section>
                  ))}
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
      {section === "children" && (
        <nav className="pagination" aria-label="Liste des enfants provisoires">
          {childPage > 1 && (
            <Link
              href={`${base}?${new URLSearchParams({ q, childPage: String(childPage - 1), ...(open ? { open } : {}) })}`}
            >
              Enfants précédents
            </Link>
          )}
          <span>
            Liste {childPage} · {data.children_total} dossier(s)
          </span>
          {childPage * 30 < data.children_total && (
            <Link
              href={`${base}?${new URLSearchParams({ q, childPage: String(childPage + 1), ...(open ? { open } : {}) })}`}
            >
              Enfants suivants
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
