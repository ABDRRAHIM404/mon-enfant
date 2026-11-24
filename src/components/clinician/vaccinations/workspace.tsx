import {
  clinicianName,
  type ClinicalAttributions,
} from "@/lib/clinical/attribution";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  History,
  Search,
  Syringe,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { EntryCard } from "@/components/clinical/entry-card";
import { ChildAvatar } from "../child-avatar";
import { NavigationFeedback } from "@/components/workspace-navigation";
import { sourceLabels, type ClinicalEntry } from "@/lib/clinical/types";
import { birthLabel, patientName, type Patient } from "@/lib/registry/types";
import { ageLabel } from "@/lib/vaccines/types";
import { ageAtVaccination, type VaccinationOverview } from "./projection";

function href(params: Record<string, string>) {
  return `/vaccinations?${new URLSearchParams(params)}`;
}

function Pager({
  page,
  total,
  size,
  label,
  link,
}: {
  page: number;
  total: number;
  size: number;
  label: string;
  link: (page: number) => string;
}) {
  const more = page * size < total && page < 10000;
  if (page === 1 && !more) return null;
  return (
    <nav className="consultation-pagination" aria-label={label}>
      {page > 1 && (
        <Link href={link(page - 1)} prefetch={false}>
          Précédent
          <NavigationFeedback />
        </Link>
      )}
      <span aria-current="page">Page {page}</span>
      {more && (
        <Link href={link(page + 1)} prefetch={false}>
          Suivant
          <NavigationFeedback />
        </Link>
      )}
    </nav>
  );
}

function HistoryRow({
  entry,
  attributions,
  child,
}: {
  entry: ClinicalEntry;
  attributions: ClinicalAttributions;
  child: Patient;
}) {
  const age = ageAtVaccination(child, entry);
  const withdrawn = entry.entry_state === "withdrawn";
  const observed = entry.source_type === "observed";
  const confirmed =
    !withdrawn &&
    !!entry.occurred_on &&
    entry.occurrence_precision === "exact" &&
    (entry.source_verified || observed);
  const label = entry.payload.vaccine_label || "Vaccin non précisé";
  const dose = entry.payload.dose_label;
  return (
    <details className="consultation-entry vaccination-record">
      <summary>
        <span className="consultation-icon">
          <Syringe size={21} aria-hidden="true" />
        </span>
        <span className="vaccination-record-copy">
          <strong>
            {label}
            {dose ? ` · ${dose}` : ""}
          </strong>
          <span>
            {entry.occurred_on ? (
              <time dateTime={entry.occurred_on}>{entry.occurred_on}</time>
            ) : (
              "Date inconnue"
            )}
            {entry.occurred_on &&
              entry.occurrence_precision === "estimated" &&
              " (estimée)"}
            {age !== null && ` · Âge : ${age} j`}
          </span>
          <small>
            {sourceLabels[entry.source_type]} ·{" "}
            {entry.source_verified
              ? "Source contrôlée"
              : "Source non confirmée"}{" "}
            · {clinicianName(attributions, entry.professional_id)}
          </small>
        </span>
        <span
          className="vaccination-status"
          data-tone={withdrawn ? "neutral" : confirmed ? "confirmed" : "review"}
        >
          {withdrawn ? "Retirée" : confirmed ? "Documentée" : "À vérifier"}
        </span>
        <ChevronDown
          className="consultation-chevron"
          size={18}
          aria-hidden="true"
        />
      </summary>
      <EntryCard entry={entry} heading={false} attributions={attributions} />
    </details>
  );
}

export function VaccinationsWorkspace({
  child,
  matches,
  q,
  childPage,
  childTotal,
  page,
  overview,
  capabilities,
  attributions,
}: {
  child: Patient | null;
  matches: Patient[];
  q: string;
  childPage: number;
  childTotal: number;
  page: number;
  overview: VaccinationOverview | null;
  capabilities: string[];
  attributions: ClinicalAttributions;
}) {
  const base = { q, childPage: String(childPage) };
  const childPath = child ? `/patients/${child.id}` : "";
  const canRecord = capabilities.includes("vaccination");
  const canPlan = capabilities.includes("appointment");
  const rows = overview?.projection.upcoming ?? [];

  function upcomingRow(row: (typeof rows)[number]) {
    return (
      <li className="vaccination-upcoming-row" key={row.rule.dose_code}>
        <Syringe size={20} aria-hidden="true" />
        <span>
          <strong>
            {row.label && `${row.label} · `}
            {row.rule.dose_code}
          </strong>
          <small>{ageLabel(row.rule.age)}</small>
        </span>
        <span className="vaccination-date">
          <CalendarDays size={16} aria-hidden="true" />
          <span>
            <time dateTime={row.startOn}>{row.startOn}</time>
            {row.startOn !== row.endOn && (
              <>
                {" "}
                au <time dateTime={row.endOn}>{row.endOn}</time>
              </>
            )}
          </span>
        </span>
        <span className="vaccination-status" data-tone="review">
          {row.needsReview ? "À vérifier" : "À venir"}
        </span>
      </li>
    );
  }

  return (
    <div className="consultations-workspace vaccination-workspace">
      <header className="consultation-heading">
        <div className="consultation-heading-copy">
          <span>Espace soignant</span>
          <h1 id="main-content" tabIndex={-1}>
            Vaccinations
          </h1>
          <p>
            Historique, calendrier et suivi vaccinal de vos enfants autorisés.
          </p>
        </div>
        <Image
          src="/dashboard-art/vaccinations-hero.webp"
          width={1059}
          height={350}
          alt=""
          unoptimized
        />
        <div className="vaccination-heading-action">
          {child && canRecord ? (
            <Link
              className="consultation-new"
              href={`${childPath}/records/new?kind=vaccination`}
              prefetch={false}
            >
              <Syringe size={20} aria-hidden="true" />
              Enregistrer une vaccination
              <NavigationFeedback />
            </Link>
          ) : (
            !child && (
              <Link
                className="consultation-new"
                href="/patients/new"
                prefetch={false}
              >
                <UserRound size={20} aria-hidden="true" />
                Inscrire un enfant
                <NavigationFeedback />
              </Link>
            )
          )}
        </div>
      </header>
      <div className="consultation-grid">
        <aside
          className="consultation-panel consultation-picker"
          aria-labelledby="vaccination-picker"
        >
          <div className="consultation-panel-title">
            <span className="consultation-icon">
              <UserRound size={22} aria-hidden="true" />
            </span>
            <h2 id="vaccination-picker">Sélectionner un enfant</h2>
          </div>
          <Form action="/vaccinations" className="consultation-search" key={q}>
            <label htmlFor="vaccination-search">
              Rechercher dans mes dossiers autorisés
            </label>
            <div className="consultation-search-field">
              <input
                id="vaccination-search"
                name="q"
                type="search"
                maxLength={100}
                defaultValue={q}
                placeholder="Nom, identifiant, registre…"
              />
              <button type="submit" aria-label="Rechercher un enfant">
                <Search size={20} aria-hidden="true" />
              </button>
            </div>
          </Form>
          <ul className="consultation-patients" role="list">
            {matches.map((patient) => (
              <li key={patient.id}>
                <Link
                  href={href({ ...base, child: patient.id })}
                  prefetch={false}
                  aria-current={child?.id === patient.id ? "true" : undefined}
                >
                  <ChildAvatar sex={patient.sex} size={42} />
                  <span>
                    <strong>{patientName(patient)}</strong>
                    <small>{birthLabel(patient)}</small>
                  </span>
                  {child?.id === patient.id && (
                    <CircleCheck size={22} aria-hidden="true" />
                  )}
                  <NavigationFeedback />
                </Link>
              </li>
            ))}
          </ul>
          {!matches.length && (
            <p className="consultation-muted">
              Aucun dossier autorisé ne correspond à cette recherche.
            </p>
          )}
          <Pager
            page={childPage}
            total={childTotal}
            size={30}
            label="Pages des enfants"
            link={(n) => href({ ...base, childPage: String(n) })}
          />
        </aside>

        <div className="consultation-main vaccination-main">
          {child && overview ? (
            <>
              <section
                className="consultation-panel consultation-profile"
                aria-labelledby="vaccination-child"
              >
                <div className="consultation-child">
                  <ChildAvatar sex={child.sex} size={65} />
                  <div>
                    <h2 id="vaccination-child">{patientName(child)}</h2>
                    <ul className="consultation-child-meta" role="list">
                      <li>
                        {child.sex === "male"
                          ? "Garçon"
                          : child.sex === "female"
                            ? "Fille"
                            : "Sexe non renseigné"}
                      </li>
                      <li>
                        {child.birth_date
                          ? `Naissance : ${birthLabel(child)}`
                          : "Date de naissance inconnue"}
                      </li>
                      {child.registers?.map((r) => (
                        <li
                          key={`${r.facility_id}/${r.year}/${r.book}/${r.number}`}
                        >
                          Registre local : {r.number} / {r.year} / {r.book} ·{" "}
                          {r.facility_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <nav
                  className="consultation-actions"
                  aria-label="Actions du dossier vaccinal"
                >
                  <Link
                    className="consultation-active"
                    href={childPath}
                    prefetch={false}
                  >
                    <UserRound size={19} aria-hidden="true" />
                    Profil de l’enfant
                    <NavigationFeedback />
                  </Link>
                  <Link
                    href={`${childPath}/records?kind=vaccination`}
                    prefetch={false}
                  >
                    <History size={19} aria-hidden="true" />
                    Historique et corrections
                    <NavigationFeedback />
                  </Link>
                </nav>
                {!canRecord && (
                  <p className="consultation-permission">
                    Une habilitation de vaccination est nécessaire pour
                    enregistrer une administration.
                  </p>
                )}
              </section>

              <section
                className="consultation-panel vaccination-panel"
                aria-labelledby="vaccination-history-title"
              >
                <div className="consultation-panel-title">
                  <span className="consultation-icon">
                    <Syringe size={22} aria-hidden="true" />
                  </span>
                  <h2 id="vaccination-history-title">
                    Historique des vaccinations enregistrées
                  </h2>
                  <span className="vaccination-count">
                    {overview.history.total}
                  </span>
                </div>
                {overview.history.items.length ? (
                  overview.history.items.map((entry) => (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      child={child}
                      attributions={attributions}
                    />
                  ))
                ) : (
                  <p className="consultation-muted">
                    Aucune vaccination enregistrée sur cette page.
                  </p>
                )}
                <Pager
                  page={page}
                  total={overview.history.total}
                  size={30}
                  label="Pages de l’historique vaccinal"
                  link={(n) =>
                    href({ ...base, child: child.id, page: String(n) })
                  }
                />
              </section>

              <section
                className="consultation-panel vaccination-panel"
                aria-labelledby="vaccination-upcoming-title"
              >
                <div className="consultation-panel-title">
                  <span className="consultation-icon">
                    <CalendarDays size={22} aria-hidden="true" />
                  </span>
                  <h2 id="vaccination-upcoming-title">
                    Prochaines vaccinations <small>(calendrier PNI)</small>
                  </h2>
                </div>
                {overview.projection.reviewHB1 && (
                  <aside className="vaccination-guidance">
                    <TriangleAlert size={19} aria-hidden="true" />
                    <div>
                      <strong>Hépatite B : historique à vérifier</strong>
                      <p>
                        Vérifiez la date et la source au registre. HB1 est
                        envisagée seulement si le registre confirme que la dose
                        de naissance HBn a été omise.
                      </p>
                      {canPlan && (
                        <Link
                          href={`${childPath}/appointments/new`}
                          prefetch={false}
                        >
                          Planifier un suivi manuel
                        </Link>
                      )}
                    </div>
                  </aside>
                )}
                {overview.projection.draftPreview && (
                  <p className="notice">
                    Bêta · Dates indicatives calculées à partir du calendrier
                    PNI en brouillon. Données fictives uniquement. Aucun
                    rendez-vous n’est créé.
                  </p>
                )}
                {rows.length ? (
                  <>
                    <p className="consultation-muted">
                      Dates calculées · {overview.projection.schedule?.label} ·
                      À vérifier au registre.
                    </p>
                    <ul className="vaccination-upcoming" role="list">
                      {rows.slice(0, 4).map(upcomingRow)}
                    </ul>
                    {rows.length > 4 && (
                      <details className="vaccination-more">
                        <summary>
                          Voir les autres doses ({rows.length - 4})
                        </summary>
                        <ul className="vaccination-upcoming" role="list">
                          {rows.slice(4).map(upcomingRow)}
                        </ul>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="consultation-muted">
                    {!overview.historyComplete
                      ? "Historique trop volumineux ou incomplet pour vérifier automatiquement les prochaines doses."
                      : !overview.projection.schedule
                        ? overview.catalogSearchComplete
                          ? "Aucune version du calendrier PNI approuvée et vérifiée n’est disponible."
                          : "Aucune version approuvée dans les versions récentes. Consultez le catalogue pour examiner les autres versions."
                        : !child.birth_date ||
                            child.birth_date_precision !== "exact"
                          ? "Une date de naissance exacte est nécessaire pour calculer les dates de routine."
                          : "Aucune prochaine référence à afficher pour cet enfant."}
                  </p>
                )}
              </section>

              <section
                className="consultation-panel vaccination-panel"
                aria-labelledby="vaccination-references-title"
              >
                <div className="vaccination-reference-header">
                  <div>
                    <div className="consultation-panel-title">
                      <span className="consultation-icon">
                        <ClipboardList size={22} aria-hidden="true" />
                      </span>
                      <h2 id="vaccination-references-title">
                        Références de routine
                      </h2>
                    </div>
                    <p className="consultation-muted">
                      Calendrier PNI, références assignées et versions
                      approuvées.
                    </p>
                  </div>
                  <Link
                    className="vaccination-secondary"
                    href={`${childPath}/vaccinations`}
                    prefetch={false}
                  >
                    Voir le calendrier complet
                    <ChevronRight size={19} aria-hidden="true" />
                    <NavigationFeedback />
                  </Link>
                </div>
                {overview.references.items.length > 0 && (
                  <details className="vaccination-more">
                    <summary>
                      Références assignées ({overview.references.total})
                    </summary>
                    <ul role="list" className="vaccination-assigned">
                      {overview.references.items.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`${childPath}/vaccinations/${item.id}`}
                            prefetch={false}
                          >
                            {item.dose_code} · {item.vaccine_code}
                          </Link>
                          <small>
                            {item.state === "withdrawn"
                              ? "Retirée"
                              : item.documented_entries.length
                                ? "Administration rapprochée"
                                : "Administration non confirmée"}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            </>
          ) : (
            <section className="consultation-panel consultation-empty">
              <Syringe size={27} aria-hidden="true" />
              <h2>Aucun enfant sélectionné</h2>
              <p>
                Choisissez un dossier autorisé pour afficher son suivi vaccinal.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
