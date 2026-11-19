import Link from "next/link";
import {
  Home,
  UsersRound,
  Syringe,
  ChartNoAxesCombined,
  CalendarDays,
  FileText,
  ShieldCheck,
  Settings,
  Bell,
  Stethoscope,
  ClipboardList,
  Building2,
  UserRound,
  LogOut,
} from "lucide-react";
import {
  NavigationFeedback,
  WorkspaceMobileMenu,
} from "./workspace-navigation";
import { SidebarToggle } from "./sidebar-toggle";
import { Brand } from "./brand";
import { signOut } from "@/app/auth/actions";

type Area = "parent" | "provisional" | "clinician";
const icons = {
  home: Home,
  children: UsersRound,
  vaccinations: Syringe,
  growth: ChartNoAxesCombined,
  appointments: CalendarDays,
  documents: FileText,
  access: ShieldCheck,
  settings: Settings,
  consultations: Stethoscope,
  requests: ClipboardList,
  practices: Building2,
  account: UserRound,
  notifications: Bell,
  invitation: ShieldCheck,
};
type Item = {
  key: keyof typeof icons;
  label: string;
  href: string;
  disabled?: boolean;
};
export function WorkspaceShell({
  area,
  active = "home",
  unread,
  children,
}: {
  area: Area;
  active?: string;
  unread?: number;
  children: React.ReactNode;
}) {
  const parent = area === "parent",
    provisional = area === "provisional";
  const items: Item[] = parent
    ? [
        { key: "home", label: "Tableau de bord", href: "/parent" },
        {
          key: "children",
          label: "Mes enfants",
          href: "/parent?view=children",
        },
        {
          key: "vaccinations",
          label: "Vaccinations",
          href: "/parent?view=vaccinations",
        },
        { key: "growth", label: "Croissance", href: "/parent?view=growth" },
        {
          key: "appointments",
          label: "Rendez-vous",
          href: "/parent?view=appointments",
        },
        {
          key: "documents",
          label: "Documents",
          href: "/parent?view=documents",
        },
        {
          key: "access",
          label: "Partage & accès",
          href: "/parent?view=access",
        },
        { key: "settings", label: "Paramètres", href: "/parent/settings" },
        { key: "requests", label: "Mes demandes", href: "/parent/requests" },
        {
          key: "notifications",
          label: "Notifications",
          href: "/parent/notifications",
        },
        {
          key: "invitation",
          label: "Relier un carnet",
          href: "/parent/invitation",
        },
      ]
    : provisional
      ? [
          { key: "home", label: "Tableau de bord", href: "/provisional" },
          {
            key: "children",
            label: "Enfants",
            href: "/provisional?view=children",
          },
          {
            key: "consultations",
            label: "Consultations",
            href: "/provisional?view=consultation",
          },
          {
            key: "vaccinations",
            label: "Vaccinations",
            href: "/provisional?view=vaccination",
          },
          {
            key: "appointments",
            label: "Rendez-vous",
            href: "/provisional?view=appointment",
          },
          {
            key: "growth",
            label: "Croissance",
            href: "/provisional?view=growth",
          },
          {
            key: "documents",
            label: "Documents",
            href: "/provisional?view=documents",
            disabled: true,
          },
          { key: "account", label: "Mon compte soignant", href: "/account" },
        ]
      : [
          { key: "home", label: "Tableau de bord", href: "/dashboard" },
          { key: "children", label: "Patients", href: "/patients" },
          { key: "vaccinations", label: "Vaccinations", href: "/vaccines" },
          { key: "appointments", label: "Calendrier", href: "/appointments" },
          { key: "requests", label: "Suivis", href: "/follow-up" },
          {
            key: "access",
            label: "Demandes d’accès",
            href: "/access-requests",
          },
          {
            key: "documents",
            label: "Revues d’inscription",
            href: "/registration-reviews",
          },
          {
            key: "consultations",
            label: "Demandes des parents",
            href: "/parent-requests",
          },
          { key: "practices", label: "Lieux d’exercice", href: "/practices" },
          {
            key: "growth",
            label: "Dossiers provisoires",
            href: "/provisional",
          },
          { key: "account", label: "Mon compte", href: "/account" },
        ];
  const mobile = items.filter((item) =>
    ["home", "children", "appointments", "documents"].includes(item.key),
  );
  function navigationItem(item: Item) {
    const Icon = icons[item.key];
    return item.disabled ? (
      <span
        className="workspace-nav-unavailable"
        aria-disabled="true"
        key={item.key}
      >
        <Icon size={17} aria-hidden="true" />
        <span>
          {item.label}
          <small>Indisponible en provisoire</small>
        </span>
      </span>
    ) : (
      <Link
        key={item.key}
        href={item.href}
        title={item.label}
        aria-current={active === item.key ? "page" : undefined}
      >
        <Icon size={17} aria-hidden="true" />
        <span className="rail-label">{item.label}</span>
        <NavigationFeedback />
      </Link>
    );
  }
  return (
    <div className="workspace-site">
      <header className="workspace-topbar">
        <Brand />
        <SidebarToggle controls="workspace-navigation-rail" />
        <nav className="workspace-discovery" aria-label="Découvrir Mon Enfant">
          <Link href="/">Accueil</Link>
          <Link href="/#fonctionnalites">Fonctionnalités</Link>
          <Link href="/#securite">Sécurité</Link>
          <Link href="/#aide">Aide</Link>
        </nav>
        <nav
          className="workspace-account"
          aria-label={parent ? "Compte parent" : "Compte soignant"}
        >
          <Link
            className="workspace-alert-link"
            href={
              parent
                ? "/parent/notifications"
                : provisional
                  ? "/provisional?view=appointment"
                  : "/follow-up"
            }
          >
            <Bell size={19} aria-hidden="true" />
            <span className="sr-only">
              {parent
                ? "Notifications"
                : provisional
                  ? "Rendez-vous"
                  : "Suivis"}
            </span>
            {unread !== undefined && unread > 0 && (
              <span className="notification-count">{unread}</span>
            )}
          </Link>
          <Link
            className="workspace-chip workspace-account-link"
            aria-label={parent ? "Mon compte" : "Compte soignant"}
            href={parent ? "/parent/account" : "/account"}
          >
            <UserRound
              className="workspace-account-icon"
              size={19}
              aria-hidden="true"
            />
            <span className="workspace-account-label">
              {parent ? "Compte parent" : "Compte soignant"}
            </span>
          </Link>
        </nav>
      </header>
      <WorkspaceMobileMenu label={parent ? "Menu parent" : "Menu soignant"}>
        <nav
          aria-label={
            parent
              ? "Toutes les rubriques parent"
              : "Toutes les rubriques soignant"
          }
        >
          {items.map(navigationItem)}
          {!parent && !provisional && (
            <Link href="/share">
              Lire un partage parent
              <NavigationFeedback />
            </Link>
          )}
          <form action={signOut}>
            <button
              className="text-link workspace-signout"
              title="Se déconnecter"
            >
              <LogOut size={17} aria-hidden="true" />
              <span className="rail-label">Se déconnecter</span>
            </button>
          </form>
        </nav>
      </WorkspaceMobileMenu>
      <aside id="workspace-navigation-rail" className="workspace-sidebar">
        <nav aria-label={parent ? "Navigation parent" : "Espace soignant"}>
          {items.map(navigationItem)}
          {!parent && !provisional && (
            <Link href="/share" title="Lire un partage parent">
              <ShieldCheck size={17} aria-hidden="true" />
              <span className="rail-label">Lire un partage parent</span>
            </Link>
          )}
          <form action={signOut}>
            <button
              className="text-link workspace-signout"
              title="Se déconnecter"
            >
              <LogOut size={17} aria-hidden="true" />
              <span className="rail-label">Se déconnecter</span>
            </button>
          </form>
        </nav>
      </aside>
      <main className="workspace-content">
        {children}
        <p className="workspace-development fine">
          Environnement de développement · Données fictives uniquement
        </p>
      </main>
      {!parent && (
        <nav
          className="workspace-mobile-nav"
          aria-label="Accès rapides soignant"
        >
          {mobile
            .filter((item) => !item.disabled)
            .map((item) => {
              const Icon = icons[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active === item.key ? "page" : undefined}
                >
                  <Icon size={21} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>
      )}
    </div>
  );
}
