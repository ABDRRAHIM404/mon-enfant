import Link from "next/link";
import { DashboardHeading } from "@/components/dashboard/heading";
import {
  Home,
  UsersRound,
  Stethoscope,
  Syringe,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  UserRound,
  Search,
  Bell,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/brand";
import {
  WorkspaceMobileMenu,
  NavigationFeedback,
} from "@/components/workspace-navigation";
import { getProfessional } from "@/lib/auth";
import { statusLabels, type Professional } from "@/lib/authorization";
import { signOut } from "@/app/auth/actions";
import { redirect } from "next/navigation";
export type ClinicianSection =
  | "home"
  | "children"
  | "consultations"
  | "vaccinations"
  | "appointments"
  | "growth"
  | "documents"
  | "account";
export async function ClinicianShell({
  active,
  provisional = false,
  profile: provided,
  children,
}: {
  active: ClinicianSection;
  provisional?: boolean;
  profile?: Professional | null;
  children: React.ReactNode;
}) {
  const profile = provided ?? (await getProfessional()).profile;
  if (!profile || !["doctor", "nurse"].includes(profile.role))
    redirect("/account");
  const base = provisional ? "/provisional" : "";
  const items = [
    {
      key: "home",
      label: "Tableau de bord",
      href: provisional ? base : "/dashboard",
      icon: Home,
    },
    {
      key: "children",
      label: "Enfants",
      href: provisional ? base + "/children" : "/patients",
      icon: UsersRound,
    },
    {
      key: "consultations",
      label: "Consultations",
      href: base + "/consultations",
      icon: Stethoscope,
    },
    {
      key: "vaccinations",
      label: "Vaccinations",
      href: base + "/vaccinations",
      icon: Syringe,
    },
    {
      key: "appointments",
      label: "Rendez-vous",
      href: base + "/appointments",
      icon: CalendarDays,
    },
    {
      key: "growth",
      label: "Croissance",
      href: base + "/growth",
      icon: ChartNoAxesCombined,
    },
    {
      key: "documents",
      label: "Documents",
      href: base + "/documents",
      icon: FileText,
    },
    {
      key: "account",
      label: "Mon compte soignant",
      href: "/account",
      icon: UserRound,
    },
  ];
  const links = () =>
    items.map(({ key, label, href, icon: Icon }) => (
      <Link
        key={key}
        href={href}
        aria-current={active === key ? "page" : undefined}
      >
        <Icon size={21} aria-hidden="true" />
        <span>
          {label}
          {key === "documents" && <small>Bientôt disponible</small>}
        </span>
        <NavigationFeedback />
      </Link>
    ));
  const logout = () => (
    <form action={signOut}>
      <button className="soignant-logout">
        <LogOut size={18} aria-hidden="true" />
        Se déconnecter de l’espace soignant
      </button>
    </form>
  );
  return (
    <div className="soignant-workspace">
      <aside className="soignant-sidebar">
        <Brand />
        <nav aria-label="Espace soignant">{links()}</nav>
        <div className="soignant-sidebar-footer">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            {provisional
              ? "Dossiers privés à leur auteur"
              : "Dossiers explicitement autorisés"}
          </p>
          {logout()}
        </div>
      </aside>
      <header className="soignant-header">
        <div className="soignant-mobile-brand">
          <Brand />
        </div>
        <form
          action={provisional ? base + "/children" : "/patients"}
          className="soignant-search"
        >
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="soignant-search">
            {provisional
              ? "Rechercher dans mes dossiers provisoires"
              : "Rechercher dans mes dossiers autorisés"}
          </label>
          <input
            id="soignant-search"
            type="search"
            name="q"
            maxLength={100}
            placeholder={
              provisional
                ? "Rechercher dans mes dossiers privés…"
                : "Rechercher dans mes dossiers autorisés…"
            }
          />
          <button type="submit">Rechercher</button>
        </form>
        <div className="soignant-account">
          <Link
            href={provisional ? base + "/appointments" : "/follow-up"}
            aria-label="Rendez-vous et suivis"
          >
            <Bell size={22} />
          </Link>
          <Link
            href="/account"
            aria-label="Compte soignant"
            className="soignant-account-status"
          >
            <UserRound size={24} aria-hidden="true" />
            <span>
              {profile.role === "nurse" ? "Infirmier(e)" : "Médecin"}
              <small>{statusLabels[profile.verification_status]}</small>
            </span>
          </Link>
        </div>
      </header>
      <div className="soignant-mobile-menu">
        <WorkspaceMobileMenu label="Menu soignant">
          <nav aria-label="Toutes les rubriques soignant">
            {links()}
            {logout()}
          </nav>
        </WorkspaceMobileMenu>
      </div>
      <main className="soignant-main">
        {children}
        <p className="soignant-development">
          Environnement de développement · Données fictives uniquement
        </p>
      </main>
    </div>
  );
}
export function ClinicianHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const section = (
    {
      Enfants: "children",
      Consultations: "consultations",
      Vaccinations: "vaccinations",
      Croissance: "growth",
      Documents: "documents",
      "Rendez-vous": "appointments",
    } as Record<string, string>
  )[title];
  return (
    <DashboardHeading
      title={title}
      description={description}
      section={section}
      clinician
    >
      {children}
    </DashboardHeading>
  );
}
