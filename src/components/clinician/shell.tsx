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
  ShieldCheck,
  Building2,
  ClipboardList,
  MessageSquare,
  QrCode,
  KeyRound,
  Wrench,
  BookOpen,
} from "lucide-react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Brand } from "@/components/brand";
import {
  DashboardAccount,
  DashboardLogout,
  DashboardMobileNavigation,
} from "./dashboard-navigation";
import {
  ClinicianNavLink,
  ClinicianNavigationState,
  ClinicianToolMenu,
} from "./navigation-state";
import type { Professional } from "@/lib/authorization";
import { statusLabels } from "@/lib/authorization";
import { signOut } from "@/app/auth/actions";
import { redirect } from "next/navigation";
import type { ClinicianSection } from "./routes";

export function ClinicianShell({
  provisional = false,
  profile,
  children,
}: {
  provisional?: boolean;
  profile: Professional | null;
  children: React.ReactNode;
}) {
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
    ...(!provisional
      ? [
          {
            key: "sharing",
            label: "Scanner un QR partagé",
            href: "/share",
            icon: QrCode,
          },
        ]
      : []),
    {
      key: "guide",
      label: "Guide et aide",
      href: provisional ? "/provisional/guide" : "/guide-soignant",
      icon: BookOpen,
    },
    {
      key: "account",
      label: "Mon compte soignant",
      href: "/account",
      icon: UserRound,
    },
  ];
  const links = (featuresOnly = false) =>
    items
      .filter(({ key }) => !featuresOnly || key !== "account")
      .map(({ key, label, href, icon: Icon }) => (
        <ClinicianNavLink
          key={key}
          href={href}
          section={key as ClinicianSection}
          title={label}
        >
          <Icon size={21} aria-hidden="true" />
          <span className="rail-label">
            {label}
            {key === "documents" && <small>Bientôt disponible</small>}
          </span>
        </ClinicianNavLink>
      ));
  const tools = [
    {
      key: "followup",
      label: "Suivis et alertes",
      href: "/follow-up",
      icon: Bell,
    },
    {
      key: "practices",
      label: "Lieux d’exercice",
      href: "/practices",
      icon: Building2,
    },
    {
      key: "access",
      label: "Autorisations des dossiers",
      href: "/access-requests",
      icon: ShieldCheck,
    },
    {
      key: "registry",
      label: "Revues d’inscription",
      href: "/registration-reviews",
      icon: ClipboardList,
    },
    {
      key: "parents",
      label: "Demandes des parents",
      href: "/parent-requests",
      icon: MessageSquare,
    },
    {
      key: "permissions",
      label: "Mes habilitations",
      href: "/account/clinical-permissions",
      icon: KeyRound,
    },
  ];
  const toolsMenu = (desktop = false) =>
    !provisional && (
      <ClinicianToolMenu
        desktop={desktop}
        heading={
          <>
            <Wrench size={18} aria-hidden="true" />
            <span className="rail-label">Outils et accès</span>
          </>
        }
      >
        {tools
          .filter(({ key }) => key !== "permissions")
          .map(({ key, label, href, icon: Icon }) => (
            <ClinicianNavLink key={key} href={href} tool title={label}>
              <Icon size={18} aria-hidden="true" />
              <span className="rail-label">{label}</span>
            </ClinicianNavLink>
          ))}
        <ClinicianNavLink href="/vaccines" tool title="Référentiel vaccinal">
          <BookOpen size={18} aria-hidden="true" />
          <span className="rail-label">Référentiel vaccinal</span>
        </ClinicianNavLink>
        {!desktop && (
          <>
            <ClinicianNavLink href="/patients/new?source=paper">
              <FileText size={18} aria-hidden="true" />
              Transcrire un dossier papier
            </ClinicianNavLink>
            <ClinicianNavLink href="/patients/link">
              <UsersRound size={18} aria-hidden="true" />
              Rattacher un dossier existant
            </ClinicianNavLink>
            <ClinicianNavLink href="/provisional">
              <FileText size={18} aria-hidden="true" />
              Mes dossiers provisoires
            </ClinicianNavLink>
          </>
        )}
      </ClinicianToolMenu>
    );
  const role = profile.role === "nurse" ? "Infirmier(e)" : "Médecin";
  const status = statusLabels[profile.verification_status];
  const verified = profile.verification_status === "approved";
  return (
    <ClinicianNavigationState>
      <div className="soignant-workspace soignant-workspace--shared">
        <aside id="clinician-navigation-rail" className="soignant-sidebar">
          <Brand clinician />
          <nav aria-label="Espace soignant">{links()}</nav>
          {toolsMenu(true)}
          <div className="soignant-sidebar-footer">
            <form action={signOut}>
              <DashboardLogout />
            </form>
          </div>
        </aside>
        <header className="soignant-header">
          <SidebarToggle controls="clinician-navigation-rail" />
          <div className="soignant-mobile-brand">
            <Brand clinician />
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
                  ? "Rechercher un dossier provisoire…"
                  : "Rechercher un enfant, un dossier…"
              }
            />
            <button type="submit" aria-label="Rechercher">
              <kbd>Ctrl + K</kbd>
            </button>
          </form>
          <div className="soignant-account">
            <Link
              href={provisional ? base + "/appointments" : "/follow-up"}
              aria-label="Rendez-vous et suivis"
            >
              <Bell size={22} aria-hidden="true" />
            </Link>
            <DashboardAccount role={role} status={status} verified={verified}>
              <nav aria-label="Options du compte soignant">
                <Link href="/account">
                  <UserRound size={18} aria-hidden="true" />
                  Mon compte soignant
                </Link>
                <Link href="/account#soignant-settings">
                  <Wrench size={18} aria-hidden="true" />
                  Paramètres
                </Link>
                <Link href="/verification">
                  <ShieldCheck size={18} aria-hidden="true" />
                  Vérification du compte
                </Link>
                {!provisional && (
                  <Link href="/account/clinical-permissions">
                    <KeyRound size={18} aria-hidden="true" />
                    Mes habilitations
                  </Link>
                )}
              </nav>
              <form action={signOut}>
                <DashboardLogout />
              </form>
            </DashboardAccount>
          </div>
        </header>
        <DashboardMobileNavigation provisional={provisional}>
          <nav aria-label="Toutes les rubriques soignant">{links(true)}</nav>
          {toolsMenu()}
        </DashboardMobileNavigation>
        <main className="soignant-main">
          {children}
          <p className="soignant-development">
            Bêta de test · Données fictives uniquement
          </p>
        </main>
      </div>
    </ClinicianNavigationState>
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
