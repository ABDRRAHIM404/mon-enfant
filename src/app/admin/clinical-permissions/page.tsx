import { statusLabels, type VerificationState } from "@/lib/authorization";
import { clinicalLabels } from "@/lib/clinical/types";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireClinicalPermissionManager } from "@/lib/auth";
import {
  AdminShell,
  AdminHeading,
  AdminStatus,
  AdminEmpty,
} from "@/components/verification/admin-nav";
import { PermissionForm } from "@/components/clinical/permission-form";
export const dynamic = "force-dynamic";
type Professional = {
  user_id: string;
  professional_id: string;
  verification_status: string;
  capabilities: {
    capability: string;
    enabled: boolean;
    expires_at: string | null;
  }[];
};
export default async function ClinicalPermissions({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { supabase } = await requireClinicalPermissionManager();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 100),
    page = Math.min(10000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const { data, error } = await supabase.rpc("list_clinical_permissions", {
    p_query: q,
    p_page: page,
  });
  if (error) throw new Error("Impossible de charger les habilitations.");
  const result = data as { items: Professional[]; total: number };
  const selected = result.items.length === 1 ? result.items[0] : null;
  const history = selected
    ? await supabase.rpc("clinical_capability_history", {
        p_professional_id: selected.user_id,
      })
    : null;
  if (history?.error)
    throw new Error("Impossible de charger l’historique des habilitations.");
  return (
    <AdminShell active="permissions">
      <AdminHeading
        section="permissions"
        title="Habilitations cliniques"
        description="Gérez les activités autorisées et retrouvez l’historique des contrôles."
      />
      <p className="admin-context-note">
        La gestion des habilitations est distincte de la revue d’identité. Elle
        ne donne pas accès aux dossiers d’enfants.
      </p>
      <section className="panel">
        <div className="admin-section-title">
          <div>
            <h2>Rechercher un professionnel</h2>
            <p className="muted">
              Saisissez son identifiant pour consulter ses habilitations.
            </p>
          </div>
        </div>
        <form className="registry-filters" action="/admin/clinical-permissions">
          <label>
            Identifiant professionnel
            <input name="q" defaultValue={q} maxLength={100} />
          </label>
          <button className="button primary">Rechercher</button>
        </form>
        <p className="fine">
          {result.total} professionnel(s) · 30 par page · recherchez
          l’identifiant pour ouvrir le formulaire et son historique.
        </p>
        <div className="admin-permission-list">
          {!result.items.length && (
            <AdminEmpty title="Aucun professionnel trouvé">
              Essayez un autre identifiant ou effacez la recherche.
            </AdminEmpty>
          )}
          {result.items.map((p) => (
            <article key={p.user_id} className="admin-permission-card">
              <h3>
                <Link
                  className="text-link"
                  href={`/admin/clinical-permissions?q=${encodeURIComponent(p.professional_id)}`}
                >
                  {p.professional_id}
                </Link>
              </h3>
              <AdminStatus value={p.verification_status}>
                {statusLabels[p.verification_status as VerificationState] ??
                  p.verification_status}
              </AdminStatus>
              {p.capabilities.map((c) => (
                <p className="admin-capability" key={c.capability}>
                  <span>
                    {clinicalLabels[
                      c.capability as keyof typeof clinicalLabels
                    ] ??
                      (c.capability === "appointment"
                        ? "Gestion des rendez-vous"
                        : c.capability)}
                  </span>
                  <span>
                    {c.enabled ? "Accordée" : "Révoquée"}
                    {c.expires_at
                      ? ` · échéance ${new Date(c.expires_at).toLocaleDateString("fr-MA", { timeZone: "UTC" })} (UTC)`
                      : ""}
                  </span>
                </p>
              ))}
            </article>
          ))}
        </div>
        <nav className="pagination" aria-label="Pagination des habilitations">
          {page > 1 ? (
            <Link
              href={`/admin/clinical-permissions?${new URLSearchParams({ q, page: String(page - 1) })}`}
            >
              Page précédente
            </Link>
          ) : (
            <span />
          )}
          {page * 30 < result.total && page < 10000 && (
            <Link
              href={`/admin/clinical-permissions?${new URLSearchParams({ q, page: String(page + 1) })}`}
            >
              Page suivante
            </Link>
          )}
        </nav>
      </section>
      {selected && (
        <section className="panel">
          <div className="admin-section-title">
            <div>
              <h2>Modifier une habilitation</h2>
              <p className="muted">
                {selected.professional_id} · Une décision motivée et historisée.
              </p>
            </div>
          </div>
          <PermissionForm
            professionalId={selected.user_id}
            operationId={randomUUID()}
          />
          <h3>Historique des contrôles et décisions</h3>
          <div className="record-list">
            {(
              history?.data as {
                id: string;
                capability: string;
                enabled: boolean;
                reason: string;
                evidence_reference: string;
                actor_id: string;
                created_at: string;
              }[]
            ).map((h) => (
              <article key={h.id}>
                <strong>
                  {clinicalLabels[
                    h.capability as keyof typeof clinicalLabels
                  ] ??
                    (h.capability === "appointment"
                      ? "Gestion des rendez-vous"
                      : h.capability)}{" "}
                  — {h.enabled ? "accordée" : "révoquée"}
                </strong>
                <p>{h.reason}</p>
                <p>Source contrôlée : {h.evidence_reference}</p>
                <p className="fine">
                  Acteur {h.actor_id} · {h.created_at}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
