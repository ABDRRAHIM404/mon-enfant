import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { Plus, UsersRound, ChevronRight } from "lucide-react";
import { getProfessional } from "@/lib/auth";
import { WorkspaceShell } from "@/components/workspace-shell";
import { ProvisionalChildForm } from "@/components/provisional/forms";
import { provisionalKinds, type ProvisionalChild } from "@/lib/provisional";
import { statusLabels } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export default async function ProvisionalWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; view?: string; new?: string }>;
}) {
  const { profile, supabase } = await getProfessional();
  if (!profile) redirect("/account");
  const q = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(q.page) || 1));
  const kind =
    q.view && Object.hasOwn(provisionalKinds, q.view)
      ? (q.view as keyof typeof provisionalKinds)
      : null;
  const { data, error } = await supabase.rpc("provisional_workspace", {
    p_page: page,
  });
  if (error?.code === "42501") redirect("/account");
  if (error) throw new Error("Espace provisoire indisponible.");
  const result = data as {
    items: ProvisionalChild[];
    total: number;
    summary: {
      consultations_week: number;
      vaccinations: number;
      appointments_upcoming: number;
      week_start: string;
    };
  };
  const tiles = [
    {
      label: "DOSSIERS PRIVÉS",
      value: result.total,
      caption: "Enfants provisoires",
    },
    {
      label: "CONSULTATIONS",
      value: result.summary.consultations_week,
      caption: "Cette semaine · dates exactes",
    },
    {
      label: "VACCINATIONS",
      value: result.summary.vaccinations,
      caption: "Entrées provisoires actives",
    },
    {
      label: "RENDEZ-VOUS",
      value: result.summary.appointments_upcoming,
      caption: "À venir · planifiés",
    },
  ];
  const active = kind
    ? (
        {
          consultation: "consultations",
          vaccination: "vaccinations",
          appointment: "appointments",
          growth: "growth",
          prescription: "consultations",
          risk: "consultations",
        } as Record<string, string>
      )[kind]
    : q.view === "children"
      ? "children"
      : q.view === "documents"
        ? "documents"
        : "home";
  return (
    <WorkspaceShell area="provisional" active={active}>
      <section className="workspace-heading">
        <span className="eyebrow">ESPACE MÉDECIN / INFIRMIER(ÈRE)</span>
        <h1 id="main-content" tabIndex={-1}>
          Bonjour, soignant
        </h1>
        <p className="muted">Votre espace clinique Mon Enfant.</p>
      </section>
      <section className="workspace-verification workspace-attention">
        <div>
          <span className="workspace-status">
            Compte : {statusLabels[profile.verification_status]}
          </span>
          <h2>Vos dossiers restent provisoires</h2>
          <p className="muted">
            Privés à leur auteur. Les données ajoutées ne sont pas visibles par
            d’autres soignants. La vérification du compte ne les valide ni ne
            les publie.
          </p>
        </div>
        <Link className="button attention" href="/verification">
          {profile.verification_status === "approved"
            ? "Consulter ma vérification"
            : "Soumettre mes justificatifs"}
        </Link>
      </section>
      {profile.verification_status === "approved" && (
        <p className="workspace-secondary">
          <Link className="text-link" href="/dashboard">
            Ouvrir mes dossiers autorisés →
          </Link>
        </p>
      )}
      <div className="workspace-stat-grid">
        {tiles.map((tile) => (
          <section
            className="workspace-surface workspace-stat"
            key={tile.label}
          >
            <span className="eyebrow">{tile.label}</span>
            <strong>{tile.value}</strong>
            <p className="muted">{tile.caption}</p>
          </section>
        ))}
      </div>
      <section className="workspace-section" id="dossiers">
        <div className="workspace-section-heading">
          <h2>Mes dossiers provisoires</h2>
          <Link className="button primary" href="/provisional?new=1#new-child">
            <Plus size={18} aria-hidden="true" />
            Nouveau dossier
          </Link>
        </div>
        {kind && (
          <p className="workspace-selection-help muted">
            Choisissez votre dossier pour ajouter ou consulter :{" "}
            {provisionalKinds[kind]}.
          </p>
        )}
        {q.view === "documents" && (
          <p className="workspace-selection-help muted">
            Consultez l’historique et la provenance dans votre dossier privé.
            Aucun export ni partage d’un dossier provisoire n’est disponible.
          </p>
        )}
        <div className="workspace-child-grid">
          {result.items.map((child) => (
            <article className="workspace-child-card" key={child.id}>
              <UsersRound
                className="workspace-avatar"
                size={54}
                aria-hidden="true"
              />
              <div>
                <h3>
                  <Link
                    href={`/provisional/${child.id}${kind ? `?kind=${kind}` : ""}`}
                  >
                    {child.identity.given_name || "Prénom inconnu"}{" "}
                    {child.identity.family_name || "Nom inconnu"}
                  </Link>
                </h3>
                <p className="muted">Dossier privé</p>
                <span className="workspace-chip">Non vérifié</span>
                <p className="sr-only">
                  Naissance : {child.identity.birth_date || "Inconnue"}
                </p>
              </div>
              <ChevronRight size={17} aria-hidden="true" />
            </article>
          ))}
        </div>
        {!result.items.length && (
          <p className="workspace-empty">Aucun dossier créé.</p>
        )}
        <nav className="pagination" aria-label="Pages de mes dossiers">
          {page > 1 && (
            <Link href={`?page=${page - 1}${kind ? `&view=${kind}` : ""}`}>
              ← Précédent
            </Link>
          )}
          {result.total > page * 30 && (
            <Link href={`?page=${page + 1}${kind ? `&view=${kind}` : ""}`}>
              Suivant →
            </Link>
          )}
        </nav>
      </section>
      <details
        className="workspace-surface workspace-secondary"
        id="new-child"
        open={q.new === "1"}
      >
        <summary>Créer un enfant</summary>
        <ProvisionalChildForm operationId={randomUUID()} />
      </details>
      <p className="fine">
        Aucun accès aux dossiers d’autres soignants. Pour consulter un carnet
        partagé, votre compte doit être vérifié et recevoir une autorisation
        distincte.
      </p>
    </WorkspaceShell>
  );
}
