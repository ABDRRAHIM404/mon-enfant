import Link from "next/link";
import { ParentSection } from "@/components/parents/section";
import { notFound, redirect } from "next/navigation";
import {
  UsersRound,
  Plus,
  ChevronRight,
  Syringe,
  ChartNoAxesCombined,
  CalendarDays,
  FileText,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { patientName, birthLabel } from "@/lib/registry/types";
import type { ParentBooklet, ParentWorkspaceData } from "@/lib/parents/types";
import type { AppointmentRow } from "@/lib/appointments/types";
import { clinicalLabels } from "@/lib/clinical/types";
import { appointmentTime } from "@/lib/appointments/calendar";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  ParentProfileForm,
  ParentProfileDisclosure,
} from "@/components/parents/profile-form";
import { NavigationFeedback } from "@/components/workspace-navigation";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const sections = new Set([
  "children",
  "vaccinations",
  "growth",
  "appointments",
  "documents",
  "access",
]);
const quickLinks = [
  {
    view: "vaccinations",
    title: "Vaccinations",
    Icon: Syringe,
  },
  {
    view: "growth",
    title: "Croissance",
    Icon: ChartNoAxesCombined,
  },
  {
    view: "appointments",
    title: "Rendez-vous",
    Icon: CalendarDays,
  },
  {
    view: "documents",
    title: "Documents",
    Icon: FileText,
  },
  {
    view: "access",
    title: "Partage & accès",
    Icon: ShieldCheck,
  },
];
export default async function ParentWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; child?: string; page?: string }>;
}) {
  const query = await searchParams;
  const { view } = query;
  const focusedSection = view && sections.has(view) ? view : null;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("parent_home_summary");
  if (error?.code === "42501") redirect("/login");
  if (error) throw new Error("Impossible de charger votre espace parent.");
  const {
    profile,
    children,
    claims,
    next_appointment: next,
    unread_total: unread,
  } = data as ParentWorkspaceData & {
    next_appointment: AppointmentRow | null;
    unread_total: number;
  };
  if (focusedSection) {
    return (
      <WorkspaceShell area="parent" active={view} unread={unread}>
        <ParentSection
          section={focusedSection}
          childrenList={children}
          query={query}
        />
      </WorkspaceShell>
    );
  }
  const selected = query.child
    ? children.find((child) => child.id === query.child)
    : children[0];
  if (query.child && !selected) notFound();

  let recent: ParentBooklet["entries"] = [];
  if (selected) {
    const booklet = await supabase.rpc("parent_child_booklet", {
      p_child_id: selected.id,
      p_page: 1,
    });
    if (booklet.error?.code === "42501" || (!booklet.data && !booklet.error))
      notFound();
    if (booklet.error)
      throw new Error("Impossible de charger l’activité du carnet.");
    recent = (booklet.data as ParentBooklet).entries.slice(0, 4);
  }
  const nextChild =
    next && children.find((child) => child.id === next.child_id);

  return (
    <WorkspaceShell area="parent" active="home" unread={unread}>
      <section className="workspace-heading parent-welcome">
        <div>
          <span className="eyebrow">Espace parent</span>
          <h1 id="main-content" tabIndex={-1}>
            Mes carnets de santé
          </h1>
          <p className="muted">
            L’activité de vos carnets et les prochains rendez-vous.
          </p>
        </div>
        <div className="actions">
          <Link className="button primary" href="/parent/add-child">
            <Plus size={17} aria-hidden="true" /> Ajouter un enfant
          </Link>
          <Link className="button secondary" href="/parent/invitation">
            Relier un carnet
          </Link>
        </div>
      </section>

      {selected ? (
        <div className="parent-living-layout">
          <section
            className="parent-current-booklet workspace-surface"
            aria-labelledby="selected-child-heading"
          >
            {children.length > 1 && (
              <form className="parent-booklet-picker" action="/parent">
                <label>
                  Carnet à afficher
                  <select name="child" defaultValue={selected.id}>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {patientName(child)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="button secondary">
                  Afficher
                </button>
              </form>
            )}
            <div className="parent-booklet-heading">
              <span className="parent-booklet-avatar" aria-hidden="true">
                {patientName(selected).slice(0, 1)}
              </span>
              <div>
                <h2 id="selected-child-heading">{patientName(selected)}</h2>
                <p>{birthLabel(selected)}</p>
              </div>
              <Link
                className="button primary"
                href={`/parent/children/${selected.id}`}
              >
                Ouvrir le carnet <ChevronRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="parent-recent">
              <h3>Dernières entrées au carnet</h3>
              {recent.length ? (
                <ol className="booklet-timeline" role="list">
                  {recent.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <strong>{clinicalLabels[entry.kind]}</strong>
                        {entry.facility_name && <p>{entry.facility_name}</p>}
                      </div>
                      <span className="fine">
                        {entry.occurred_on || "Date inconnue"}
                        {entry.occurrence_precision === "estimated"
                          ? " (estimée)"
                          : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-state">
                  Aucune entrée de soins documentée dans ce carnet.
                </p>
              )}
            </div>
            <nav
              className="parent-booklet-links"
              aria-label="Rubriques du carnet affiché"
            >
              {quickLinks.map(({ view, title, Icon }) => (
                <Link
                  key={view}
                  href={`/parent?view=${view}&child=${selected.id}`}
                >
                  <Icon size={17} aria-hidden="true" /> {title}
                  <NavigationFeedback />
                </Link>
              ))}
            </nav>
          </section>
          <aside
            className="parent-family-overview"
            aria-label="Suivi de la famille"
          >
            <section className="workspace-surface">
              <CalendarDays size={21} aria-hidden="true" />
              <h2>Prochain rendez-vous de la famille</h2>
              {next && nextChild ? (
                <>
                  <p>
                    <strong>{next.purpose_label}</strong>
                  </p>
                  <p className="muted">
                    {patientName(nextChild)} · {appointmentTime(next.starts_at)}
                  </p>
                  <Link
                    className="text-link"
                    href={`/parent/children/${next.child_id}/appointments`}
                  >
                    Consulter le calendrier
                  </Link>
                </>
              ) : (
                <p className="muted">Aucun rendez-vous à venir enregistré.</p>
              )}
            </section>
            <section className="workspace-surface">
              <Bell size={21} aria-hidden="true" />
              <h2>Notifications</h2>
              <p className="muted">
                {unread
                  ? `${unread} mise${unread > 1 ? "s" : ""} à jour non lue${unread > 1 ? "s" : ""}.`
                  : "Aucune mise à jour non lue."}
              </p>
              <Link className="text-link" href="/parent/notifications">
                Consulter les notifications
              </Link>
            </section>
          </aside>
        </div>
      ) : (
        <section className="workspace-surface parent-empty-state">
          <UsersRound size={38} aria-hidden="true" />
          <h2>Aucun carnet relié</h2>
          <p>
            Ajoutez une fiche à présenter au médecin ou reliez un carnet
            existant avec l’invitation d’un soignant.
          </p>
          <Link className="button primary" href="/parent/invitation">
            Utiliser mon invitation
          </Link>
        </section>
      )}
      {claims.length > 0 && (
        <section className="workspace-surface workspace-secondary">
          <h2>Mes demandes d’accès</h2>
          <div className="record-list">
            {claims.map((claim) => (
              <article key={claim.id}>
                <p>
                  {
                    (
                      {
                        pending: "En attente de vérification",
                        approved: "Demande approuvée",
                        rejected: "Demande refusée",
                        cancelled: "Demande annulée",
                      } as Record<string, string>
                    )[claim.state]
                  }
                </p>
                <p className="fine">
                  Soumise le{" "}
                  {new Date(claim.created_at).toLocaleDateString("fr-MA")} ·
                  Référence {claim.id}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
      <ParentProfileDisclosure initiallyOpen={!profile}>
        <div className="two-columns">
          <section>
            <h2>Mon profil</h2>
            <ParentProfileForm name={profile?.display_name} />
            <p className="fine">
              Renseigner votre nom n’accorde aucun accès à un dossier médical.
            </p>
          </section>
          <section>
            <h2>Relier le carnet d’un enfant</h2>
            <p>
              Le professionnel qui suit votre enfant vous remettra une
              invitation personnelle. Votre identité et votre qualité de
              responsable devront être vérifiées avant l’ouverture du carnet.
            </p>
            <Link className="button secondary" href="/parent/invitation">
              Utiliser mon invitation
            </Link>
            <p className="fine">
              Le numéro d’un carnet ou le nom d’un enfant ne suffit pas pour y
              accéder.
            </p>
          </section>
        </div>
      </ParentProfileDisclosure>
    </WorkspaceShell>
  );
}
