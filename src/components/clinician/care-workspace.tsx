import "./patient-profile.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  Mars,
  Venus,
  UserRound,
  Zap,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardPlus,
  Pill,
  TriangleAlert,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { ChildAvatar } from "./child-avatar";
import { ClinicianSectionOverride } from "./navigation-state";
import type { ClinicianSection } from "./routes";
import { requireApprovedDoctor } from "@/lib/auth";
import { patientName, type ChildProfile } from "@/lib/registry/types";
import { PatientNavigation } from "./patient-profile-tabs";
export { PatientNavigation } from "./patient-profile-tabs";
import { bookletDate } from "@/lib/vaccines/booklet";
import { addCalendarMonths, civilDay } from "@/lib/vaccines/calendar";
import { todayCasablanca } from "@/lib/appointments/calendar";

export type PatientSection =
  | "overview"
  | "records"
  | "vaccinations"
  | "appointments"
  | "growth"
  | "guardians"
  | "summary";
function childAge(birth: string, today: string) {
  if (birth > today) return null;
  const offset =
    (Number(today.slice(0, 4)) - Number(birth.slice(0, 4))) * 12 +
    Number(today.slice(5, 7)) -
    Number(birth.slice(5, 7));
  const months = addCalendarMonths(birth, offset) > today ? offset - 1 : offset;
  const days = civilDay(today) - civilDay(addCalendarMonths(birth, months));
  const years = Math.floor(months / 12);
  const dayLabel = `${days} jour${days > 1 ? "s" : ""}`;
  if (years)
    return `${years} an${years > 1 ? "s" : ""}${months % 12 ? ` et ${months % 12} mois` : ""}`;
  return months ? `${months} mois${days ? ` et ${dayLabel}` : ""}` : dayLabel;
}
export async function ClinicalWorkspace({
  active = "children",
  childId,
  child,
  section = "overview",
  children,
  print = false,
}: {
  active?: ClinicianSection;
  childId?: string;
  child?: ChildProfile;
  section?: PatientSection;
  children: React.ReactNode;
  print?: boolean;
}) {
  let context = child;
  if (childId && !context) {
    const { supabase } = await requireApprovedDoctor();
    const result = await supabase.rpc("get_child_profile", {
      p_child_id: childId,
    });
    if (result.error?.code === "42501" || (!result.data && !result.error))
      notFound();
    if (result.error)
      throw Error("Impossible de confirmer le dossier de l’enfant.");
    context = result.data as ChildProfile;
  }
  const birth = context?.birth_date;
  const age =
    birth && context?.birth_date_precision === "exact"
      ? childAge(birth, todayCasablanca())
      : null;
  const SexIcon =
    context?.sex === "female"
      ? Venus
      : context?.sex === "male"
        ? Mars
        : UserRound;
  const sex =
    context?.sex === "female"
      ? "Fille"
      : context?.sex === "male"
        ? "Garçon"
        : "Sexe non renseigné";
  return (
    <>
      {section === "records" && <ClinicianSectionOverride section={active} />}
      <div
        className={`care-workflow${childId && context ? " child-profile" : ""}${print ? " print-summary" : ""}`}
      >
        {childId && context && (
          <>
            <nav className="care-breadcrumb no-print" aria-label="Fil d’Ariane">
              <Link href="/patients">Enfants</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <Link href={`/patients/${childId}`}>Dossier enfant</Link>
            </nav>
            <div className="care-child-context no-print">
              <ChildAvatar sex={context.sex} size={70} />
              <div className="care-child-identity">
                <strong>{patientName(context)}</strong>
                <div className="care-child-facts">
                  <span>
                    <SexIcon size={16} aria-hidden="true" />
                    {sex}
                  </span>
                  <span>
                    <CalendarDays size={16} aria-hidden="true" />
                    {birth ? (
                      <time dateTime={birth}>{bookletDate(birth)}</time>
                    ) : (
                      "Naissance inconnue"
                    )}
                    {birth &&
                      context.birth_date_precision === "estimated" &&
                      " (estimée)"}
                  </span>
                  {age && <span className="care-child-age">{age}</span>}
                  {context.name_status === "provisional" && (
                    <span>Identité provisoire</span>
                  )}
                </div>
              </div>
              <span className="care-context-label">
                <ShieldCheck size={17} aria-hidden="true" />
                Dossier autorisé
              </span>
            </div>
            <PatientNavigation
              childId={childId}
              active={section}
              canManageAccess={context.can_manage_access}
            />
          </>
        )}
        {children}
      </div>
    </>
  );
}

const careActions = [
  {
    kind: "consultation",
    title: "Ajouter une consultation",
    description: "Motif, observations et plan de soins.",
    suffix: "/records/new?kind=consultation",
    icon: ClipboardPlus,
  },
  {
    kind: "vaccination",
    title: "Enregistrer une vaccination",
    description: "Dose administrée ou historique transcrit.",
    suffix: "/records/new?kind=vaccination",
    icon: Syringe,
  },
  {
    kind: "appointment",
    title: "Planifier un rendez-vous",
    description: "Créneau, lieu et motif du prochain suivi.",
    suffix: "/appointments/new",
    icon: CalendarPlus,
  },
  {
    kind: "growth",
    title: "Ajouter une mesure",
    description: "Poids, taille et périmètre crânien.",
    suffix: "/records/new?kind=growth",
    icon: ChartNoAxesCombined,
  },
  {
    kind: "prescription",
    title: "Ajouter un traitement",
    description: "Prescription et instructions du professionnel.",
    suffix: "/records/new?kind=prescription",
    icon: Pill,
  },
  {
    kind: "risk",
    title: "Documenter un risque",
    description: "Allergie, risque et source de l’information.",
    suffix: "/records/new?kind=risk",
    icon: TriangleAlert,
  },
] as const;
export function ChildCareActions({
  childId,
  allowed,
  compact = false,
}: {
  childId: string;
  allowed: string[];
  compact?: boolean;
}) {
  return (
    <section
      className={`care-actions-panel no-print${compact ? " overview-card overview-actions" : ""}`}
      aria-labelledby="care-actions-title"
    >
      <div className="care-section-heading">
        <div>
          <h2 id="care-actions-title">
            {compact ? (
              <>
                <Zap size={22} aria-hidden="true" /> Actions rapides
              </>
            ) : (
              "Ajouter au suivi de cet enfant"
            )}
          </h2>
          {!compact && <p>Choisissez l’information à enregistrer.</p>}
        </div>
        <Link href="/account/clinical-permissions" className="text-link">
          Mes habilitations
        </Link>
      </div>
      <div className="care-action-grid">
        {careActions.map(({ kind, title, description, suffix, icon: Icon }) =>
          allowed.includes(kind) ? (
            <Link
              className="care-action-card"
              data-kind={kind}
              key={kind}
              href={`/patients/${childId}${suffix}`}
            >
              <Icon size={23} aria-hidden="true" />
              <strong>{title}</strong>
              {!compact && <span>{description}</span>}
              <ChevronRight
                className="care-action-open"
                aria-hidden="true"
                size={18}
              />
            </Link>
          ) : (
            <div className="care-action-card is-unavailable" key={kind}>
              <Icon size={23} aria-hidden="true" />
              <strong>{title}</strong>
              <span>Habilitation non active pour ce compte.</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
