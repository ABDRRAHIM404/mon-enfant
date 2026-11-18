import Link from "next/link";
import {
  ClipboardCheck,
  CircleHelp,
  UsersRound,
  ArrowUpRight,
  KeyRound,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { requireReviewer } from "@/lib/auth";
import { AdminShell, AdminHeading } from "@/components/verification/admin-nav";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const { supabase } = await requireReviewer();
  const [pending, additional, professionals] = await Promise.all([
    supabase
      .from("verification_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "under_review"),
    supabase
      .from("verification_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "needs_more_evidence"),
    supabase
      .from("professional_profiles")
      .select("user_id", { count: "exact", head: true })
      .in("role", ["doctor", "nurse"]),
  ]);
  if (pending.error || additional.error || professionals.error)
    throw Error("Impossible de charger la synthèse administrative.");
  const metrics = [
    {
      label: "Demandes à examiner",
      value: pending.count ?? 0,
      icon: ClipboardCheck,
      href: "/admin/verifications?status=under_review",
      tone: "mint",
    },
    {
      label: "Compléments demandés",
      value: additional.count ?? 0,
      icon: CircleHelp,
      href: "/admin/verifications?status=needs_more_evidence",
      tone: "amber",
    },
    {
      label: "Comptes professionnels",
      value: professionals.count ?? 0,
      icon: UsersRound,
      href: "/admin/professionals",
      tone: "coral",
    },
  ];
  const tasks = [
    {
      title: "Vérifier les professionnels",
      description:
        "Examiner les justificatifs et enregistrer une décision motivée.",
      href: "/admin/verifications",
      icon: ClipboardCheck,
    },
    {
      title: "Gérer les comptes",
      description:
        "Consulter les statuts, suspendre ou réactiver un compte avec un motif.",
      href: "/admin/professionals",
      icon: UsersRound,
    },
    {
      title: "Habilitations cliniques",
      description:
        "Gérer les activités autorisées et retrouver l’historique des contrôles.",
      href: "/admin/clinical-permissions",
      icon: KeyRound,
    },
    {
      title: "Catalogue vaccinal",
      description:
        "Consulter les versions de référence, les sources et les revues.",
      href: "/vaccines",
      icon: BookOpen,
    },
  ];
  return (
    <AdminShell active="home">
      <AdminHeading
        section="home"
        title="Vue d’ensemble"
        description="Les demandes et les outils de votre espace d’administration."
      />
      <div className="admin-metrics">
        {metrics.map(({ label, value, icon: Icon, href, tone }) => (
          <Link href={href} className="admin-metric panel" key={label}>
            <span className="admin-metric-icon" data-tone={tone}>
              <Icon size={23} aria-hidden="true" />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <div className="admin-section-title">
        <div>
          <h2>À votre disposition</h2>
          <p className="muted">Retrouvez chaque outil dans sa rubrique.</p>
        </div>
      </div>
      <div className="admin-task-grid">
        {tasks.map(({ title, description, href, icon: Icon }) => (
          <Link className="panel admin-task" href={href} key={href}>
            <span className="admin-task-icon">
              <Icon size={24} aria-hidden="true" />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="text-link">
                Ouvrir la rubrique <ArrowUpRight size={15} aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}
      </div>
      <aside className="admin-context-note">
        <ShieldCheck size={22} aria-hidden="true" />
        <p>
          <strong>Des autorisations distinctes.</strong> La revue d’identité, la
          gestion des habilitations et celle du catalogue dépendent de
          permissions séparées. Le rôle administrateur ne donne pas accès aux
          carnets des enfants.
        </p>
      </aside>
    </AdminShell>
  );
}
