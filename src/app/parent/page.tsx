import Link from "next/link";
import Image from "next/image";
import { familyIllustration } from "@/components/dashboard/art";
import { ParentSection } from "@/components/parents/section";
import { redirect } from "next/navigation";
import {
  UsersRound,
  Plus,
  ChevronRight,
  Syringe,
  ChartNoAxesCombined,
  CalendarDays,
  FileText,
  Bell,
  ClipboardList,
} from "lucide-react";
import { patientName, birthLabel } from "@/lib/registry/types";
import type { ParentWorkspaceData } from "@/lib/parents/types";
import type { AppointmentRow } from "@/lib/appointments/types";
import { appointmentTime } from "@/lib/appointments/calendar";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  ParentProfileForm,
  ParentProfileDisclosure,
} from "@/components/parents/profile-form";
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
    description: "Références et doses documentées",
    Icon: Syringe,
  },
  {
    view: "growth",
    title: "Croissance",
    description: "Poids et taille",
    Icon: ChartNoAxesCombined,
  },
  {
    view: "appointments",
    title: "Rendez-vous",
    description: "Suivi des consultations",
    Icon: CalendarDays,
  },
  {
    view: "documents",
    title: "Documents",
    description: "Bientôt disponible",
    Icon: FileText,
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
  return (
    <WorkspaceShell area="parent" active="home" unread={unread}>
      <section className="workspace-heading parent-welcome">
        <div>
          <span className="eyebrow">ESPACE PARENT</span>
          <h1 id="main-content" tabIndex={-1}>
            {profile ? `Bonjour, ${profile.display_name}` : "Bonjour"}
          </h1>
          <p className="muted">
            Retrouvez l’essentiel du suivi de vos enfants.
          </p>
        </div>
        <Image
          src={familyIllustration}
          placeholder={familyIllustration.blurDataURL ? "blur" : "empty"}
          alt=""
          width={240}
          height={204}
          priority
        />
      </section>
      <div className="parent-summary-grid">
        <Link
          href="/parent?view=children"
          className="workspace-surface parent-summary-card"
        >
          <UsersRound size={28} aria-hidden="true" />
          <div>
            <strong>{children.length}</strong>
            <span>
              Carnet{children.length > 1 ? "s" : ""} relié
              {children.length > 1 ? "s" : ""}
            </span>
          </div>
        </Link>
        <Link
          href="/parent/notifications"
          className="workspace-surface parent-summary-card"
        >
          <Bell size={28} aria-hidden="true" />
          <div>
            <strong>{unread}</strong>
            <span>
              Mise{unread > 1 ? "s" : ""} à jour non lue{unread > 1 ? "s" : ""}
            </span>
          </div>
        </Link>
        <Link
          href="/parent?view=appointments"
          className="workspace-surface parent-summary-card"
        >
          <CalendarDays size={28} aria-hidden="true" />
          <div>
            <strong className="parent-summary-date">
              {next ? appointmentTime(next.starts_at) : "Aucun à venir"}
            </strong>
            <span>Prochain rendez-vous enregistré</span>
          </div>
        </Link>
        <Link
          href="/parent/invitation"
          className="workspace-surface parent-summary-card"
        >
          <ClipboardList size={28} aria-hidden="true" />
          <div>
            <strong>
              {claims.filter((claim) => claim.state === "pending").length}
            </strong>
            <span>Demandes en cours</span>
          </div>
        </Link>
      </div>
      <div className="parent-home-layout">
        <section className="workspace-section" id="children">
          <div className="workspace-section-heading">
            <h2>Mes enfants</h2>
            <Link href="/parent?view=children">Gérer mes enfants →</Link>
          </div>
          <div className="workspace-child-grid">
            {children.map((child) => (
              <article className="workspace-child-card" key={child.id}>
                <UsersRound
                  className="workspace-avatar"
                  size={54}
                  aria-hidden="true"
                />
                <div>
                  <h3>
                    <Link href={`/parent/children/${child.id}`}>
                      {patientName(child)}
                    </Link>
                  </h3>
                  <p className="muted">{birthLabel(child)}</p>
                  <span className="workspace-chip">Accès vérifié</span>
                  <p className="sr-only">
                    {child.universal_id} · Accès jusqu’au{" "}
                    {new Date(child.expires_at).toLocaleDateString("fr-MA", {
                      timeZone: "Africa/Casablanca",
                    })}
                  </p>
                </div>
                <ChevronRight size={17} aria-hidden="true" />
              </article>
            ))}
            <article className="workspace-child-card workspace-add-child">
              <div>
                <Plus
                  className="workspace-avatar"
                  size={44}
                  aria-hidden="true"
                />
                <h3>
                  <Link href="/parent/invitation">Ajouter un enfant</Link>
                </h3>
                <p className="muted">À partir d’une invitation sécurisée.</p>
              </div>
            </article>
          </div>
          {!children.length && (
            <p className="workspace-empty">
              Aucun carnet relié pour le moment. Une demande en attente ne donne
              pas encore accès aux informations de l’enfant.
            </p>
          )}
        </section>
        <section className="workspace-surface dashboard-guide">
          <h2>Que pouvez-vous faire ici ?</h2>
          <div>
            {quickLinks.map(({ view, title, description, Icon }) => (
              <Link key={view} href={`/parent?view=${view}`}>
                <span className={`dashboard-guide-icon guide-${view}`}>
                  <Icon size={24} aria-hidden="true" />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      {!focusedSection && (
        <>
          <div className="workspace-overview-grid">
            <section className="workspace-surface workspace-next-appointment">
              <span className="eyebrow">PROCHAIN RENDEZ-VOUS</span>
              {next ? (
                <>
                  <h3>{next.purpose_label}</h3>
                  <p className="muted">
                    {[next.child_given_name, next.child_family_name]
                      .filter(Boolean)
                      .join(" ") || "Enfant au nom inconnu"}{" "}
                    · {appointmentTime(next.starts_at)}
                  </p>
                  <Link
                    className="workspace-chip"
                    href={`/parent/children/${next.child_id}/appointments`}
                  >
                    <CalendarDays size={14} aria-hidden="true" />
                    Voir le détail →
                  </Link>
                </>
              ) : (
                <>
                  <h3>Aucun rendez-vous à venir enregistré</h3>
                  <p className="muted">
                    Consultez le carnet de l’enfant ou contactez son soignant
                    pour confirmer le prochain suivi.
                  </p>
                </>
              )}
            </section>
            <section
              className={
                unread
                  ? "workspace-surface workspace-attention"
                  : "workspace-surface"
              }
            >
              <span className="eyebrow">
                {unread ? "NOUVELLES DU CARNET" : "VOTRE SUIVI"}
              </span>
              <h3>
                {unread
                  ? `${unread} mise${unread > 1 ? "s" : ""} à jour non lue${unread > 1 ? "s" : ""}`
                  : "Vos informations restent à jour dans le carnet"}
              </h3>
              <p className="muted">
                Les notifications concernent les dossiers qui vous sont
                autorisés. Aucune vaccination n’est déduite d’une information
                absente.
              </p>
              <Link className="text-link" href="/parent/notifications">
                <Bell size={15} aria-hidden="true" />
                Consulter les notifications →
              </Link>
            </section>
          </div>
        </>
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
