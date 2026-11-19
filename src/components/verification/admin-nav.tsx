import {
  DashboardSkeleton,
  type SkeletonVariant,
} from "@/components/dashboard/skeleton";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardCheck,
  UsersRound,
  KeyRound,
  BookOpen,
  UserRound,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Brand } from "@/components/brand";
import {
  NavigationFeedback,
  WorkspaceMobileMenu,
} from "@/components/workspace-navigation";
import { signOut } from "@/app/auth/actions";

const items = [
  {
    key: "home",
    label: "Vue d’ensemble",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    key: "requests",
    label: "Vérifications",
    href: "/admin/verifications",
    icon: ClipboardCheck,
  },
  {
    key: "professionals",
    label: "Professionnels",
    href: "/admin/professionals",
    icon: UsersRound,
  },
  {
    key: "permissions",
    label: "Habilitations cliniques",
    href: "/admin/clinical-permissions",
    icon: KeyRound,
  },
  {
    key: "catalog",
    label: "Catalogue vaccinal",
    href: "/vaccines",
    icon: BookOpen,
  },
  { key: "account", label: "Mon compte", href: "/account", icon: UserRound },
] as const;
export type AdminSection = (typeof items)[number]["key"];

export function AdminNav({ active = "home" }: { active?: AdminSection }) {
  return (
    <nav aria-label="Administration" className="admin-navigation">
      <span className="admin-nav-label">Espace de travail</span>
      {items.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          title={label}
          aria-current={active === key ? "page" : undefined}
        >
          <Icon size={19} aria-hidden="true" />
          <span className="rail-label">{label}</span>
          <NavigationFeedback />
        </Link>
      ))}
      <form action={signOut} className="admin-signout">
        <button title="Se déconnecter">
          <LogOut size={18} aria-hidden="true" />
          <span className="rail-label">Se déconnecter</span>
        </button>
      </form>
    </nav>
  );
}

export function AdminShell({
  active,
  children,
}: {
  active: AdminSection;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-workspace">
      <header className="admin-topbar">
        <Brand />
        <SidebarToggle controls="admin-navigation-rail" />
        <div className="admin-topbar-context">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Console d’administration</span>
          <span className="admin-restricted">Accès restreint</span>
        </div>
        <Link href="/account" className="admin-account-link">
          <UserRound size={19} aria-hidden="true" />
          <span>Mon compte</span>
        </Link>
      </header>
      <aside id="admin-navigation-rail" className="admin-sidebar">
        <AdminNav active={active} />
        <div className="admin-sidebar-note">
          <ShieldCheck size={20} aria-hidden="true" />
          <strong>Des décisions tracées</strong>
          <p>Chaque décision conserve son motif et son historique.</p>
        </div>
      </aside>
      <WorkspaceMobileMenu label="Menu administration">
        <AdminNav active={active} />
      </WorkspaceMobileMenu>
      <main className="admin-content">
        {children}
        <p className="admin-footer fine">
          Mon Enfant · Administration · Données fictives uniquement
        </p>
      </main>
    </div>
  );
}

export function AdminHeading({
  title,
  description,
  section,
  children,
}: {
  title: string;
  description: string;
  section: AdminSection;
  children?: React.ReactNode;
}) {
  const Icon = items.find((item) => item.key === section)?.icon ?? ShieldCheck;
  return (
    <section className="admin-heading">
      <div>
        <span className="eyebrow">Administration</span>
        <h1 id="main-content" tabIndex={-1}>
          {title}
        </h1>
        <p>{description}</p>
        {children}
      </div>
      <span className="admin-heading-icon">
        <Icon size={40} strokeWidth={1.5} aria-hidden="true" />
      </span>
    </section>
  );
}

export function AdminStatus({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <span className="admin-status" data-status={value}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

export function AdminEmpty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="admin-empty">
      <ClipboardCheck size={30} strokeWidth={1.5} aria-hidden="true" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function AdminLoading({
  active = "home",
  variant = "list",
}: {
  active?: AdminSection;
  variant?: SkeletonVariant;
}) {
  return (
    <AdminShell active={active}>
      <section id="main-content" tabIndex={-1}>
        <DashboardSkeleton
          variant={variant}
          label="Chargement de l’administration…"
        />
      </section>
    </AdminShell>
  );
}
