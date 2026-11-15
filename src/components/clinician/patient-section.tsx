import Link from "next/link";
import { notFound } from "next/navigation";
import { ClinicianChildPicker } from "./child-picker";
import { requireApprovedDoctor } from "@/lib/auth";
import {
  patientName,
  uuidPattern,
  type Patient,
  type ChildProfile,
} from "@/lib/registry/types";
import { type ClinicalEntry } from "@/lib/clinical/types";
import { EntryCard } from "@/components/clinical/entry-card";
import { GrowthChart } from "@/components/clinical/growth-chart";
import { ClinicianShell, ClinicianHeading } from "./shell";
import type { SectionQuery } from "./provisional-section";
const sections = {
  consultations: {
    title: "Consultations",
    kind: "consultation",
    description: "Consultations et historique de vos enfants autorisés.",
    action: "Nouvelle consultation",
  },
  vaccinations: {
    title: "Vaccinations",
    kind: "vaccination",
    description:
      "Historique réel, sources et références de routine de vos enfants autorisés.",
    action: "Enregistrer une vaccination",
  },
  growth: {
    title: "Croissance",
    kind: "growth",
    description:
      "Mesures enregistrées et évolution brute, sans interprétation diagnostique.",
    action: "Nouvelle mesure",
  },
} as const;
export async function PatientSection({
  section,
  query,
}: {
  section: keyof typeof sections;
  query: SectionQuery;
}) {
  const { profile, supabase } = await requireApprovedDoctor();
  const config = sections[section],
    base = `/${section}`,
    q = (query.q || "").slice(0, 100),
    page = Math.min(10000, Math.max(1, Math.floor(Number(query.page) || 1))),
    childPage = Math.min(
      10000,
      Math.max(1, Math.floor(Number(query.childPage) || 1)),
    );
  if (query.child && !uuidPattern.test(query.child)) notFound();
  const [patients, capabilities] = await Promise.all([
    supabase.rpc("list_patients", {
      p_query: q,
      p_history: "all",
      p_age: "all",
      p_page: childPage,
    }),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (patients.error || capabilities.error)
    throw new Error("Impossible de charger cette rubrique autorisée.");
  const data = patients.data as { items: Patient[]; total: number };
  let child: Patient | null = query.child
    ? data.items.find((c) => c.id === query.child) || null
    : data.items[0] || null;
  if (query.child && !child) {
    const result = await supabase.rpc("get_child_profile", {
      p_child_id: query.child,
    });
    if (result.error?.code === "42501") notFound();
    if (result.error) throw new Error("Ce dossier est indisponible.");
    child = result.data as ChildProfile;
  }
  let history: { items: ClinicalEntry[]; total: number } = {
    items: [],
    total: 0,
  };
  let references: {
    items: {
      id: string;
      dose_code: string;
      vaccine_code: string;
      state: string;
      documented_entries: unknown[];
    }[];
    total: number;
  } = { items: [], total: 0 };
  if (child) {
    const [timeline, referenceResult] = await Promise.all([
      supabase.rpc("clinical_timeline", {
        p_child_id: child.id,
        p_page: page,
        p_kind: config.kind,
      }),
      section === "vaccinations"
        ? supabase.rpc("patient_vaccine_items", {
            p_child_id: child.id,
            p_page: 1,
          })
        : Promise.resolve(null),
    ]);
    if (
      timeline.error?.code === "42501" ||
      referenceResult?.error?.code === "42501"
    )
      notFound();
    if (timeline.error) throw new Error("Impossible de charger l’historique.");
    if (referenceResult?.error)
      throw new Error("Références vaccinales indisponibles.");
    history = timeline.data;
    if (referenceResult) references = referenceResult.data;
  }

  const allowed = (capabilities.data as string[]).includes(config.kind),
    appointmentAllowed = (capabilities.data as string[]).includes(
      "appointment",
    );
  const href = (id: string, n = 1) =>
    `${base}?${new URLSearchParams({ child: id, page: String(n), childPage: String(childPage), q })}`;
  return (
    <ClinicianShell active={section} profile={profile}>
      <ClinicianHeading title={config.title} description={config.description}>
        {child && allowed ? (
          <Link
            className="button primary"
            href={`/patients/${child.id}/records/new?kind=${config.kind}`}
          >
            {config.action}
          </Link>
        ) : !child ? (
          <Link className="button primary" href="/patients/new">
            Ajouter un enfant
          </Link>
        ) : null}
      </ClinicianHeading>
      <div className="soignant-section-grid">
        <ClinicianChildPicker
          base={base}
          q={q}
          page={childPage}
          total={data.total}
          items={data.items.map((c) => ({
            id: c.id,
            label: patientName(c),
            caption: c.birth_date || "Date de naissance inconnue",
          }))}
          current={child ? { id: child.id, label: patientName(child) } : null}
        />
        <div>
          {child ? (
            <>
              <section className="panel">
                <h2>{patientName(child)}</h2>
                <p className="muted">
                  Dossier autorisé · {history.total} saisie(s) de cette
                  rubrique.
                </p>
                <div className="tabs">
                  <Link href={`/patients/${child.id}`}>Profil de l’enfant</Link>
                  <Link
                    href={`/patients/${child.id}/records?kind=${config.kind}`}
                  >
                    Historique et corrections
                  </Link>
                  {section === "consultations" && (
                    <>
                      <Link
                        href={`/patients/${child.id}/records?kind=prescription`}
                      >
                        Traitements / prescriptions
                      </Link>
                      <Link href={`/patients/${child.id}/records?kind=risk`}>
                        Risques et allergies
                      </Link>
                    </>
                  )}
                </div>
                {!allowed && (
                  <p className="notice">
                    Consultation autorisée. Une habilitation clinique explicite
                    est nécessaire pour cette saisie.
                  </p>
                )}
              </section>
              <section className="panel" id="section-history">
                <h2>
                  {section === "vaccinations"
                    ? "Historique des vaccinations enregistrées"
                    : section === "growth"
                      ? "Historique des mesures"
                      : "Historique des consultations"}
                </h2>
                {history.items.length ? (
                  history.items.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))
                ) : (
                  <p className="empty-state">
                    Aucune saisie de cette rubrique pour cet enfant sur cette
                    page. Aucune observation ni date n’est inventée.
                  </p>
                )}
              </section>
              {section === "vaccinations" && (
                <>
                  <section className="soignant-attention">
                    <h2>Historique enregistré et suite du suivi</h2>
                    <p>
                      HB1 : aucune prochaine dose ni aucun rattrapage n’est
                      calculé automatiquement. Une source non confirmée reste un
                      historique à examiner ; elle ne prouve pas une vaccination
                      manquée.
                    </p>
                    <p>
                      Les références de routine sont distinctes des
                      administrations et des rendez-vous. Une saisie seule ne
                      planifie aucun rendez-vous.
                    </p>
                    {appointmentAllowed && (
                      <Link
                        className="button secondary"
                        href={`/patients/${child.id}/appointments/new`}
                      >
                        Planifier un suivi manuel
                      </Link>
                    )}
                  </section>
                  <section className="panel">
                    <h2>Références de routine ({references.total})</h2>
                    {!references.items.length ? (
                      <p>
                        Aucune référence assignée. L’historique enregistré
                        ci-dessus est conservé indépendamment de la revue d’une
                        source et de la planification du suivi.
                      </p>
                    ) : (
                      references.items.map((item) => (
                        <article key={item.id}>
                          <h3>
                            {item.dose_code} · {item.vaccine_code}
                          </h3>
                          <p>
                            {item.state === "withdrawn"
                              ? "Référence retirée"
                              : item.documented_entries.length
                                ? "Administration documentée et rapprochée"
                                : "Administration non confirmée — aucune dose manquée déduite"}
                          </p>
                          <Link
                            className="text-link"
                            href={`/patients/${child.id}/vaccinations/${item.id}`}
                          >
                            Décisions et historique de la référence
                          </Link>
                        </article>
                      ))
                    )}
                    <Link
                      className="text-link"
                      href={`/patients/${child.id}/vaccinations`}
                    >
                      Examiner les références, dates et versions approuvées
                    </Link>
                    {references.total > 20 && (
                      <p className="fine">
                        20 premières références ; la vue détaillée donne accès
                        aux pages suivantes.
                      </p>
                    )}
                  </section>
                </>
              )}
              {section === "growth" && (
                <>
                  <div className="soignant-two-column">
                    <GrowthChart
                      entries={history.items}
                      field="height_cm"
                      label="Taille"
                      unit="cm"
                    />
                    <GrowthChart
                      entries={history.items}
                      field="weight_kg"
                      label="Poids"
                      unit="kg"
                    />
                  </div>
                  <p className="notice">
                    Mesures brutes de cette page seulement. Les dates inconnues
                    ou estimées restent dans l’historique ; aucun percentile,
                    diagnostic ou statut de croissance normale n’est calculé.
                  </p>
                </>
              )}

              <nav
                className="pagination"
                aria-label="Historique de cette rubrique"
              >
                {page > 1 && (
                  <Link href={href(child.id, page - 1)}>
                    Entrées précédentes
                  </Link>
                )}
                <span>Page {page} · 30 saisies par page</span>
                {page * 30 < history.total && (
                  <Link href={href(child.id, page + 1)}>Entrées suivantes</Link>
                )}
              </nav>
            </>
          ) : (
            <section className="panel">
              <h2>Aucun enfant sélectionné</h2>
              <p>
                Choisissez un dossier autorisé ou ajustez votre recherche pour
                afficher son historique et les actions disponibles.
              </p>
              <Link className="text-link" href="/patients/new">
                Inscrire un enfant
              </Link>
            </section>
          )}
        </div>
      </div>
    </ClinicianShell>
  );
}
