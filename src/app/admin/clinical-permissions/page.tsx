import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireClinicalPermissionManager } from "@/lib/auth";
import { AdminNav } from "@/components/verification/admin-nav";
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
    <main className="account-page wide">
      <AdminNav />
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Habilitations cliniques
        </h1>
        <p className="muted">
          Permission d’administration distincte de la revue d’identité. Aucune
          habilitation ne donne un accès aux dossiers d’enfants.
        </p>
      </div>
      <section className="panel">
        <h2>Professionnels et habilitations</h2>
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
        <div className="record-list">
          {result.items.map((p) => (
            <article key={p.user_id}>
              <h3>
                <Link
                  className="text-link"
                  href={`/admin/clinical-permissions?q=${encodeURIComponent(p.professional_id)}`}
                >
                  {p.professional_id}
                </Link>
              </h3>
              <p>{p.verification_status}</p>
              {p.capabilities.map((c) => (
                <p className="fine" key={c.capability}>
                  {c.capability} : {c.enabled ? "accordée" : "révoquée"}
                  {c.expires_at ? ` · échéance ${c.expires_at}` : ""}
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
          <h2>Modifier l’habilitation — {selected.professional_id}</h2>
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
                  {h.capability} — {h.enabled ? "accordée" : "révoquée"}
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
    </main>
  );
}
