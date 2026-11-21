import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarPlus,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardPlus,
  Pill,
  TriangleAlert,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { ClinicianSectionOverride } from "./navigation-state";
import type { ClinicianSection } from "./routes";
import { requireApprovedDoctor } from "@/lib/auth";
import {
  patientName,
  birthLabel,
  type ChildProfile,
} from "@/lib/registry/types";
import { NavigationFeedback } from "@/components/workspace-navigation";

export type PatientSection =
  | "overview"
  | "records"
  | "vaccinations"
  | "appointments"
  | "growth"
  | "guardians"
  | "summary";
export function PatientNavigation({
  childId,
  active,
  canManageAccess = false,
}: {
  childId: string;
  active: PatientSection;
  canManageAccess?: boolean;
}) {
  const items = [
    { key: "overview", label: "Vue d’ensemble", suffix: "" },
    { key: "records", label: "Dossier clinique", suffix: "/records" },
    { key: "vaccinations", label: "Vaccinations", suffix: "/vaccinations" },
    { key: "appointments", label: "Rendez-vous", suffix: "/appointments" },
    { key: "growth", label: "Croissance", suffix: "/growth" },
    ...(canManageAccess
      ? [{ key: "guardians", label: "Accès des parents", suffix: "/guardians" }]
      : []),
    { key: "summary", label: "Résumé et impression", suffix: "/summary" },
  ];
  return (
    <nav
      className="care-patient-nav no-print"
      aria-label="Rubriques du dossier enfant"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={`/patients/${childId}${item.suffix}`}
          aria-current={active === item.key ? "page" : undefined}
        >
          {item.label}
          <NavigationFeedback />
        </Link>
      ))}
    </nav>
  );
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
  return (
    <>
      {section === "records" && <ClinicianSectionOverride section={active} />}
      <div className={`care-workflow${print ? " print-summary" : ""}`}>
        {childId && context && (
          <>
            <nav className="care-breadcrumb no-print" aria-label="Fil d’Ariane">
              <Link href="/patients">Enfants</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <Link href={`/patients/${childId}`}>Dossier enfant</Link>
            </nav>
            <div className="care-child-context">
              <span className="care-child-symbol" aria-hidden="true">
                {patientName(context).slice(0, 1)}
              </span>
              <div>
                <strong>{patientName(context)}</strong>
                <span>
                  {birthLabel(context)}
                  {context.name_status === "provisional"
                    ? " · Identité provisoire"
                    : ""}
                </span>
              </div>
              <span className="care-context-label">
                <ShieldCheck size={15} aria-hidden="true" />
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
}: {
  childId: string;
  allowed: string[];
}) {
  return (
    <section
      className="care-actions-panel no-print"
      aria-labelledby="care-actions-title"
    >
      <div className="care-section-heading">
        <div>
          <h2 id="care-actions-title">Ajouter au suivi de cet enfant</h2>
          <p>Choisissez l’information à enregistrer.</p>
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
              key={kind}
              href={`/patients/${childId}${suffix}`}
            >
              <Icon size={23} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{description}</span>
              <span className="care-action-open">Ouvrir le formulaire →</span>
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
