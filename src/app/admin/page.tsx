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
    },
    {
      label: "Compléments demandés",
      value: additional.count ?? 0,
      icon: CircleHelp,
      href: "/admin/verifications?status=needs_more_evidence",
    },
    {
      label: "Comptes professionnels",
      value: professionals.count ?? 0,
      icon: UsersRound,
      href: "/admin/professionals",
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
      <div className="operations-grid">
        <section
          className="panel operations-panel"
          aria-labelledby="operations-queue"
        >
          <h2 id="operations-queue">File de revue</h2>
          <ul>
            {metrics.map(({ label, value, icon: Icon, href }) => (
              <li key={href}>
                <Link href={href} className="operations-row">
                  <Icon size={19} aria-hidden="true" />
                  <span>{label}</span>
                  <strong className="operations-count">{value}</strong>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section
          className="panel operations-panel"
          aria-labelledby="operations-tools"
        >
          <h2 id="operations-tools">Gestion et configuration</h2>
          <ul>
            {tasks.map(({ title, description, href, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="operations-row">
                  <Icon size={19} aria-hidden="true" />
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
