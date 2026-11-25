import {
  clinicalChildHref,
  clinicalDestination,
  clinicalDestinationLabel,
} from "@/components/clinician/clinical-destinations";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  FileText,
  LayoutGrid,
  Link2,
  List,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { ChildAvatar } from "@/components/clinician/child-avatar";
import {
  RegistryFilters,
  RegistrySort,
  type RegistryQuery,
} from "@/components/clinician/registry-controls";
import { NavigationFeedback } from "@/components/workspace-navigation";
import { appointmentTime } from "@/lib/appointments/calendar";
import { requireApprovedDoctor } from "@/lib/auth";
import {
  historyLabels,
  patientName,
  birthLabel,
  type Patient,
} from "@/lib/registry/types";
import "./registry-directory.css";

export const dynamic = "force-dynamic";

const entryActions = [
  {
    href: "/patients/new",
    title: "Inscrire un enfant",
    description: "Créer un nouveau dossier",
    icon: UserRoundPlus,
    tone: "mint",
  },
  {
    href: "/patients/new?source=paper",
    title: "Transcrire un dossier papier",
    description: "Numériser un carnet existant",
    icon: FileText,
    tone: "amber",
  },
  {
    href: "/patients/link",
    title: "Rattacher un dossier existant",
    description: "Demander ou confirmer un accès",
    icon: Link2,
    tone: "coral",
  },
] as const;

const views = [
  { value: "list", label: "Vue liste", icon: List },
  { value: "grid", label: "Vue cartes", icon: LayoutGrid },
] as const;

function RegistryCard({ patient, href }: { patient: Patient; href: string }) {
  const {
    birth_date: birth,
    history_status: history,
    next_own_appointment: appointment,
  } = patient;
  const reviewed = history === "reviewed";
  const historyTone = reviewed
    ? "reviewed"
    : history === "partial"
      ? "partial"
      : "neutral";
  const HistoryIcon = reviewed ? CircleCheck : Clock3;
  return (
    <li>
      <Link className="registry-directory-card" href={href} prefetch={false}>
        <div className="registry-directory-identity">
          <ChildAvatar sex={patient.sex} size={54} />
          <div>
            <strong>{patientName(patient)}</strong>
            <div className="registry-directory-demographics">
              <span>
                {birth
                  ? `Né(e) le ${birthLabel(patient)}`
                  : "Date de naissance inconnue"}
              </span>
              {patient.name_status === "provisional" && (
                <span>Identité provisoire</span>
              )}
              {patient.registers?.map((register) => (
                <span
                  key={`${register.facility_id}/${register.year}/${register.book}/${register.number}`}
                >
                  <span className="registry-visually-hidden">
                    Registre local{" "}
                  </span>
                  {register.number} · {register.year} / {register.book} ·{" "}
                  {register.facility_name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <span className="registry-directory-badge" data-tone={historyTone}>
          <HistoryIcon size={17} aria-hidden="true" />
          {historyLabels[history] ?? historyLabels.unknown}
        </span>
        <span className="registry-directory-care">
          <CalendarDays size={17} aria-hidden="true" />
          <span>
            Dernier soin{" "}
            <b>
              {patient.last_documented_care ? (
                <time dateTime={patient.last_documented_care}>
                  {patient.last_documented_care}
                </time>
              ) : (
                "Non documenté"
              )}
            </b>
          </span>
        </span>
        <span
          className="registry-directory-badge"
          data-tone={appointment ? "scheduled" : "neutral"}
        >
          <CalendarClock size={17} aria-hidden="true" />
          <span>
            Prochain RDV{" "}
            <b>
              {appointment
                ? appointmentTime(appointment.starts_at)
                : "Non planifié"}
            </b>
          </span>
        </span>
        <ChevronRight
          size={18}
          className="registry-directory-card-arrow"
          aria-hidden="true"
        />
        <NavigationFeedback />
      </Link>
    </li>
  );
}

export default async function Patients({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ supabase }, rawParams] = await Promise.all([
    requireApprovedDoctor(),
    searchParams,
  ]);
  const get = (key: string) => {
    const value = rawParams[key];
    return typeof value === "string" ? value : "";
  };
  const history = get("history");
  const age = get("age");
  const query: RegistryQuery = {
    q: get("q").slice(0, 100),
    history: ["unknown", "partial", "reviewed"].includes(history)
      ? history
      : "all",
    age: ["under1", "1to5", "over5", "unknown"].includes(age) ? age : "all",
    page: Math.min(10000, Math.max(1, Math.floor(Number(get("page")) || 1))),
    sort: get("sort") === "name" ? "name" : "recent",
    open: clinicalDestination(get("open")),
    view: get("view") === "grid" ? "grid" : "list",
  };
  const { data, error } = await supabase.rpc("list_patients", {
    p_query: query.q,
    p_history: query.history,
    p_age: query.age,
    p_page: query.page,
  });
  if (error) throw new Error("Impossible de charger le registre.");
  const { items, total } = data as { items: Patient[]; total: number };
  const patients =
    query.sort === "name"
      ? items.toSorted((a, b) =>
          patientName(a).localeCompare(patientName(b), "fr", {
            sensitivity: "base",
          }),
        )
      : items;
  const hasFilters = Boolean(
    query.q || query.history !== "all" || query.age !== "all",
  );
  function href(changes: Partial<RegistryQuery>) {
    const next = { ...query, ...changes };
    const { page, open, ...filters } = next;
    const params = new URLSearchParams({ ...filters, page: String(page) });
    if (open) params.set("open", open);
    return `/patients?${params}`;
  }
  return (
    <div className="registry-directory">
      <header className="registry-directory-heading">
        <div>
          <span>Espace soignant</span>
          <h1 id="main-content" tabIndex={-1}>
            Enfants
          </h1>
          <p>
            {query.open
              ? `Sélectionnez un enfant pour ouvrir la rubrique « ${clinicalDestinationLabel(query.open)} ».`
              : "Retrouvez les enfants suivis et leurs dossiers autorisés."}
          </p>
        </div>
        <Image
          src="/dashboard-art/registry-hero.webp"
          width={880}
          height={326}
          alt=""
          unoptimized
        />
      </header>
      <nav
        className="registry-directory-actions"
        aria-label="Actions sur les dossiers"
      >
        {entryActions.map(({ href, title, description, icon: Icon, tone }) => (
          <div
            className="registry-directory-action"
            data-tone={tone}
            key={tone}
          >
            <Link href={href} prefetch={false}>
              <span className="registry-directory-action-icon">
                <Icon size={26} aria-hidden="true" />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ChevronRight size={20} aria-hidden="true" />
              <NavigationFeedback />
            </Link>
          </div>
        ))}
      </nav>
      <RegistryFilters
        key={JSON.stringify([query.q, query.history, query.age])}
        query={query}
      />
      <section
        className="registry-directory-results"
        aria-label="Dossiers du registre autorisé"
      >
        <div className="registry-directory-toolbar">
          <p role="status">
            {total} {total === 1 ? "dossier trouvé" : "dossiers trouvés"}
          </p>
          <div className="registry-directory-options">
            <RegistrySort key={query.sort} query={query} />
            <div
              className="registry-directory-views"
              role="group"
              aria-label="Affichage des dossiers"
            >
              {views.map(({ value, label, icon: Icon }) => (
                <Link
                  key={value}
                  href={href({ view: value })}
                  aria-label={label}
                  title={label}
                  aria-current={query.view === value ? "true" : undefined}
                  scroll={false}
                  prefetch={false}
                >
                  <Icon size={19} aria-hidden="true" />
                  <NavigationFeedback />
                </Link>
              ))}
            </div>
          </div>
        </div>
        {patients.length ? (
          <ul
            className="registry-directory-records"
            data-view={query.view}
            role="list"
          >
            {patients.map((patient) => (
              <RegistryCard
                key={patient.id}
                patient={patient}
                href={
                  query.open
                    ? clinicalChildHref(patient.id, query.open)
                    : `/patients/${patient.id}`
                }
              />
            ))}
          </ul>
        ) : (
          <div className="registry-directory-empty">
            <UsersRound size={32} aria-hidden="true" />
            <p>
              {hasFilters
                ? "Aucun dossier ne correspond à ces critères."
                : "Aucun dossier à afficher sur cette page."}
            </p>
            {hasFilters && (
              <Link
                className="text-link"
                href={href({ q: "", history: "all", age: "all", page: 1 })}
              >
                Réinitialiser la recherche
              </Link>
            )}
          </div>
        )}
        <nav
          className="registry-directory-pagination"
          aria-label="Pagination des patients"
        >
          {query.page > 1 ? (
            <Link href={href({ page: query.page - 1 })} prefetch={false}>
              <ChevronLeft size={16} aria-hidden="true" /> Précédent{" "}
              <NavigationFeedback />
            </Link>
          ) : (
            <span aria-disabled="true">
              <ChevronLeft size={16} aria-hidden="true" /> Précédent
            </span>
          )}
          <span
            className="registry-directory-page"
            aria-current="page"
            aria-label={`Page ${query.page}`}
          >
            {query.page}
          </span>
          {query.page * 30 < total && query.page < 10000 ? (
            <Link href={href({ page: query.page + 1 })} prefetch={false}>
              Suivant <ChevronRight size={16} aria-hidden="true" />{" "}
              <NavigationFeedback />
            </Link>
          ) : (
            <span aria-disabled="true">
              Suivant <ChevronRight size={16} aria-hidden="true" />
            </span>
          )}
        </nav>
      </section>
    </div>
  );
}
