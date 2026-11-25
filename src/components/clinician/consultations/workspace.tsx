import type { ClinicalAttributions } from "@/lib/clinical/attribution";
import Link from "next/link";
import {
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Folder,
  Pill,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { EntryCard } from "@/components/clinical/entry-card";
import { NavigationFeedback } from "@/components/workspace-navigation";
import {
  clinicalLabels,
  sourceLabels,
  type ClinicalEntry,
} from "@/lib/clinical/types";
import { bookletDate } from "@/lib/vaccines/booklet";
import { ChildPageHeading } from "../patient-profile";
import { ConsultationSort } from "./controls";

type Sort = "recent" | "oldest";
const pageSize = 30;
const maxPage = 10000;

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
    <li data-selected={initiallyOpen}>
      <details className="consultation-entry" open={initiallyOpen}>
        <summary>
          <CalendarCheck size={20} aria-hidden="true" />
          <span className="consultation-entry-heading">
            <strong>
              {entry.occurred_on ? (
                <time dateTime={entry.occurred_on}>
                  {bookletDate(entry.occurred_on)}
                </time>
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
  childId,
  history,
  historyPage,
  selectedRoot,
  canWrite,
  sort,
  attributions,
}: {
  childId: string;
  history: { items: ClinicalEntry[]; total: number };
  historyPage: number;
  selectedRoot?: string;
  canWrite: boolean;
  sort: Sort;
  attributions: ClinicalAttributions;
}) {
  const base = `/patients/${childId}`;
  const href = `${base}/consultations`;
  const timeline =
    sort === "recent"
      ? history.items
      : history.items.toSorted((a, b) => {
          if (!a.occurred_on) return b.occurred_on ? 1 : 0;
          if (!b.occurred_on) return -1;
          return a.occurred_on.localeCompare(b.occurred_on);
        });

  const selected =
    timeline.find(({ root_id }) => root_id === selectedRoot) ?? timeline[0];

  return (
    <div className="consultations-workspace child-consultations-workspace">
      <ChildPageHeading
        title="Consultations"
        description="Suivi des consultations de cet enfant."
        actions={
          canWrite ? (
            <Link
              className="button primary child-button child-spotlight"
              href={`${base}/records/new?kind=consultation`}
            >
              <Plus size={19} aria-hidden="true" /> Nouvelle consultation
              <NavigationFeedback />
            </Link>
          ) : (
            <Link
              className="button secondary child-button"
              href="/account/clinical-permissions"
            >
              <ShieldCheck size={18} aria-hidden="true" /> Mes habilitations
            </Link>
          )
        }
      />
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
              key={`${childId}/${sort}`}
              href={href}
              params={{ page: String(historyPage) }}
              sort={sort}
            />
          )}
        </header>
        <nav
          className="consultation-extra-actions"
          aria-label="Autres actions du dossier enfant"
        >
          <Link href={`${base}/records?kind=consultation`}>
            <Folder size={17} aria-hidden="true" /> Historique et corrections
          </Link>
          <Link href={`${base}/records?kind=prescription`}>
            <Pill size={17} aria-hidden="true" /> Traitements / prescriptions
          </Link>
          <Link href={`${base}/records?kind=risk`}>
            <TriangleAlert size={17} aria-hidden="true" /> Risques et allergies
          </Link>
        </nav>
        {timeline.length ? (
          <div className="child-consultation-columns">
            <nav
              className="child-consultation-index"
              aria-label="Choisir une consultation"
            >
              {timeline.map((entry) => (
                <Link
                  key={entry.id}
                  href={`${href}?${new URLSearchParams({ sort, page: String(historyPage), entry: entry.root_id })}`}
                  scroll={false}
                  aria-current={entry === selected ? "true" : undefined}
                >
                  <CalendarCheck size={19} aria-hidden="true" />
                  <span>
                    <strong>
                      {entry.occurred_on
                        ? bookletDate(entry.occurred_on)
                        : "Date inconnue"}
                    </strong>
                    {entry.entry_state === "withdrawn" ? (
                      <small>Consultation retirée</small>
                    ) : (
                      <small>{entry.payload.reason || "Consultation"}</small>
                    )}
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              ))}
            </nav>
            <ul className="consultation-timeline" role="list">
              {timeline.map((entry) => (
                <ConsultationEntry
                  key={entry.id}
                  entry={entry}
                  initiallyOpen={entry === selected}
                  attributions={attributions}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="consultation-empty">
            <ClipboardList size={27} aria-hidden="true" />
            <p>
              {history.total > 0
                ? "Aucune consultation sur cette page."
                : "Aucune consultation documentée pour cet enfant."}
            </p>
          </div>
        )}
        <ConsultationPagination
          label="Pages de l’historique des consultations"
          page={historyPage}
          total={history.total}
          href={(page) =>
            `${href}?${new URLSearchParams({ sort, page: String(page) })}`
          }
        />
      </section>
    </div>
  );
}
