import type { ClinicalAttributions } from "@/lib/clinical/attribution";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarCheck,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  Folder,
  Pill,
  Plus,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { EntryCard } from "@/components/clinical/entry-card";
import { NavigationFeedback } from "@/components/workspace-navigation";
import {
  clinicalLabels,
  sourceLabels,
  type ClinicalEntry,
} from "@/lib/clinical/types";
import { birthLabel, patientName, type Patient } from "@/lib/registry/types";
import { ChildAvatar } from "../child-avatar";
import { ConsultationSearch, ConsultationSort } from "./controls";

type Sort = "recent" | "oldest";
const pageSize = 30;
const maxPage = 10000;

function pageHref(params: Record<string, string>) {
  return `/consultations?${new URLSearchParams(params)}`;
}

function ConsultationPagination({
  label,
  page,
  total,
  href,
}: {
  label: string;
  page: number;
  total: number;
  href: (next: number) => string;
}) {
  const previous = page > 1;
  const next = page * pageSize < total && page < maxPage;
  if (!(previous || next)) return null;
  return (
    <nav className="consultation-pagination" aria-label={label}>
      {previous && (
        <Link prefetch={false} href={href(page - 1)}>
          Précédent
          <NavigationFeedback />
        </Link>
      )}
      <span aria-current="page">Page {page}</span>
      {next && (
        <Link prefetch={false} href={href(page + 1)}>
          Suivant
          <NavigationFeedback />
        </Link>
      )}
    </nav>
  );
}

function ConsultationEntry({
  entry,
  initiallyOpen,
  attributions,
}: {
  entry: ClinicalEntry;
  initiallyOpen: boolean;
  attributions: ClinicalAttributions;
}) {
  const withdrawn = entry.entry_state === "withdrawn";
  const source = sourceLabels[entry.source_type] ?? entry.source_type;
  return (
    <li>
      <details className="consultation-entry" open={initiallyOpen}>
        <summary>
          <CalendarCheck size={20} aria-hidden="true" />
          <span className="consultation-entry-heading">
            <strong>
              {entry.occurred_on ? (
                <time dateTime={entry.occurred_on}>{entry.occurred_on}</time>
              ) : (
                "Date inconnue"
              )}
              {entry.occurred_on &&
                entry.occurrence_precision === "estimated" &&
                " (estimée)"}
            </strong>
            <span
              className="consultation-entry-chip"
              data-tone={withdrawn ? "neutral" : "green"}
            >
              {clinicalLabels[entry.kind]}
              {withdrawn && " retirée"}
            </span>
            <span className="consultation-entry-source">
              {source} ·{" "}
              {entry.source_verified
                ? "Source contrôlée"
                : "Source non confirmée"}
            </span>
          </span>
          <ChevronDown
            className="consultation-chevron"
            size={19}
            aria-hidden="true"
          />
        </summary>
        <EntryCard entry={entry} heading={false} attributions={attributions} />
      </details>
    </li>
  );
}

export function ConsultationsWorkspace({
  query,
  child,
  matches,
  childrenPage,
  childrenTotal,
  history,
  historyPage,
  canWrite,
  sort,
  attributions,
}: {
  query: string;
  child: Patient | null;
  matches: Patient[];
  childrenPage: number;
  childrenTotal: number;
  history: { items: ClinicalEntry[]; total: number };
  historyPage: number;
  canWrite: boolean;
  sort: Sort;
  attributions: ClinicalAttributions;
}) {
  const base = { q: query, sort, childPage: String(childrenPage) };
  const childPath = child ? `/patients/${child.id}` : "";
  const newHref =
    child && canWrite ? `${childPath}/records/new?kind=consultation` : null;
  const timeline =
    sort === "recent"
      ? history.items
      : history.items.toSorted((a, b) => {
          if (!a.occurred_on) return b.occurred_on ? 1 : 0;
          if (!b.occurred_on) return -1;
          return a.occurred_on.localeCompare(b.occurred_on);
        });
  const newAction = newHref && (
    <Link className="consultation-new" href={newHref} prefetch={false}>
      <Plus size={21} aria-hidden="true" />
      Nouvelle consultation
      <NavigationFeedback />
    </Link>
  );

  return (
    <div className="consultations-workspace">
      <header className="consultation-heading">
        <div className="consultation-heading-copy">
          <span>Espace soignant</span>
          <h1 id="main-content" tabIndex={-1}>
            Consultations
          </h1>
          <p>
            Créer, consulter et suivre les consultations de vos enfants
            autorisés.
          </p>
        </div>
        <Image
          src="/dashboard-art/consultations-hero.webp"
          width={1080}
          height={349}
          alt=""
          unoptimized
        />
        {newAction && (
          <div className="consultation-phone-action">{newAction}</div>
        )}
      </header>
      <div className="consultation-grid">
        <aside
          className="consultation-panel consultation-picker"
          aria-labelledby="consultation-picker-title"
        >
          <div className="consultation-panel-title">
            <span className="consultation-icon">
              <UserRound size={22} aria-hidden="true" />
            </span>
            <h2 id="consultation-picker-title">Sélectionner un enfant</h2>
          </div>
          <ConsultationSearch key={query} query={query} sort={sort} />
          <ul className="consultation-patients" role="list">
            {matches.map((patient) => (
              <li key={patient.id}>
                <Link
                  href={pageHref({ ...base, child: patient.id })}
                  aria-current={child?.id === patient.id ? "true" : undefined}
                  prefetch={false}
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
          {matches.length === 0 && (
            <p className="consultation-muted">
              Aucun dossier autorisé ne correspond à cette recherche.
            </p>
          )}
          <ConsultationPagination
            label="Pages des enfants"
            page={childrenPage}
            total={childrenTotal}
            href={(page) => pageHref({ ...base, childPage: String(page) })}
          />
        </aside>
        <div className="consultation-main">
          {child ? (
            <>
              <section
                className="consultation-panel consultation-profile"
                aria-labelledby="consultation-child-name"
              >
                <div className="consultation-child">
                  <ChildAvatar sex={child.sex} size={65} />
                  <div>
                    <h2 id="consultation-child-name">{patientName(child)}</h2>
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
                  aria-label="Actions du dossier enfant"
                >
                  <a
                    href="#section-history"
                    className="consultation-active"
                    aria-current="location"
                  >
                    <Stethoscope size={20} aria-hidden="true" />
                    Consultations
                  </a>
                  {newAction && (
                    <div className="consultation-desktop-action">
                      {newAction}
                    </div>
                  )}
                  <Link
                    href={`${childPath}/records?kind=consultation`}
                    prefetch={false}
                  >
                    <Folder size={19} aria-hidden="true" />
                    Historique et corrections
                    <NavigationFeedback />
                  </Link>
                </nav>
                <nav
                  className="consultation-extra-actions"
                  aria-label="Autres rubriques du dossier enfant"
                >
                  <Link href={childPath} prefetch={false}>
                    <UserRound size={17} aria-hidden="true" />
                    Profil de l’enfant
                  </Link>
                  <Link
                    href={`${childPath}/records?kind=prescription`}
                    prefetch={false}
                  >
                    <Pill size={17} aria-hidden="true" />
                    Traitements / prescriptions
                  </Link>
                  <Link
                    href={`${childPath}/records?kind=risk`}
                    prefetch={false}
                  >
                    <TriangleAlert size={17} aria-hidden="true" />
                    Risques et allergies
                  </Link>
                </nav>
                {!canWrite && (
                  <p className="consultation-permission">
                    <ShieldCheck size={17} aria-hidden="true" />
                    Consultation du dossier autorisée. Une habilitation clinique
                    est nécessaire pour ajouter un soin.
                  </p>
                )}
              </section>
              <section
                className="consultation-panel consultation-history"
                id="section-history"
                aria-labelledby="consultation-history-title"
              >
                <header>
                  <div className="consultation-panel-title">
                    <span className="consultation-icon">
                      <CalendarCheck size={22} aria-hidden="true" />
                    </span>
                    <h2 id="consultation-history-title">
                      Historique des consultations
                    </h2>
                  </div>
                  {timeline.length > 1 && (
                    <ConsultationSort
                      key={`${child.id}/${sort}`}
                      params={{
                        q: query,
                        childPage: String(childrenPage),
                        child: child.id,
                        page: String(historyPage),
                      }}
                      sort={sort}
                    />
                  )}
                </header>
                {timeline.length ? (
                  <ul className="consultation-timeline" role="list">
                    {timeline.map((entry, index) => (
                      <ConsultationEntry
                        key={entry.id}
                        entry={entry}
                        initiallyOpen={index === 0}
                        attributions={attributions}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="consultation-empty">
                    <ClipboardList size={27} aria-hidden="true" />
                    <p>
                      {history.total > 0
                        ? "Aucune consultation sur cette page."
                        : "Aucune consultation documentée pour cet enfant."}
                    </p>
                    {history.total === 0 && newAction}
                  </div>
                )}
                <ConsultationPagination
                  label="Pages de l’historique des consultations"
                  page={historyPage}
                  total={history.total}
                  href={(page) =>
                    pageHref({ ...base, child: child.id, page: String(page) })
                  }
                />
              </section>
            </>
          ) : (
            <section className="consultation-panel consultation-empty">
              <ClipboardList size={29} aria-hidden="true" />
              <h2>Aucun enfant sélectionné</h2>
              <p>
                Choisissez un dossier autorisé pour afficher ses consultations.
              </p>
              <Link className="text-link" href="/patients/new" prefetch={false}>
                Inscrire un enfant
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
