import { requireReviewer } from "@/lib/auth";
import { statusLabels } from "@/lib/authorization";
import type { VerificationState } from "@/lib/authorization";
import {
  AdminShell,
  AdminHeading,
  AdminStatus,
  AdminEmpty,
} from "@/components/verification/admin-nav";
import { SuspensionForm } from "@/components/verification/review-form";
import Link from "next/link";
import type { ProfessionalSearchResult } from "@/lib/admin/professional-search";
export const dynamic = "force-dynamic";
export default async function Professionals({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const { supabase } = await requireReviewer();
  const query = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(query.page ?? "1", 10) || 1),
  );
  const q = (query.q ?? "").trim().slice(0, 254);
  const status = Object.hasOwn(statusLabels, query.status ?? "")
    ? query.status!
    : "all";
  const { data, error } = await supabase.rpc("list_admin_professionals", {
    p_query: q,
    p_status: status,
    p_page: page,
  });
  if (error) throw new Error("Impossible de charger les professionnels.");
  const { items: profiles, total: count } = data as {
    items: ProfessionalSearchResult[];
    total: number;
  };
  return (
    <AdminShell active="professionals">
      <AdminHeading
        section="professionals"
        title="Professionnels"
        description="Consultez les comptes, leur statut de vérification et les actions disponibles."
      />
      <section className="panel">
        <div className="admin-section-title">
          <div>
            <h2>Comptes professionnels</h2>
            <p className="muted">
              Toute suspension ou réactivation nécessite un motif historisé.
            </p>
          </div>
        </div>
        <form className="registry-filters" action="/admin/professionals">
          <label>
            E-mail, prénom, nom ou identifiant professionnel
            <input
              name="q"
              defaultValue={q}
              type="search"
              maxLength={254}
              placeholder="Rechercher un professionnel"
            />
          </label>
          <label>
            Statut
            <select name="status" defaultValue={status}>
              <option value="all">Tous les statuts</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary">Rechercher</button>
          <Link className="button secondary" href="/admin/professionals">
            Réinitialiser
          </Link>
        </form>
        <p className="fine">
          {count ?? 0} compte(s) · Page {page}
        </p>
        <div className="admin-professional-list">
          {!profiles?.length ? (
            <AdminEmpty title="Aucun compte professionnel">
              Les comptes médecins et infirmiers apparaîtront ici.
            </AdminEmpty>
          ) : (
            profiles.map((p) => (
              <article key={p.user_id} className="admin-professional-card">
                <div className="admin-professional-summary">
                  <div className="admin-person-icon" aria-hidden="true">
                    {p.role === "nurse" ? "I" : "M"}
                  </div>
                  <div>
                    <h3>
                      {p.display_name ||
                        p.professional_id ||
                        "Compte professionnel"}
                    </h3>
                    {p.email && <p>{p.email}</p>}
                    <p className="muted">
                      {p.role === "nurse" ? "Infirmier(e)" : "Médecin"}
                      {" · "}
                      {p.professional_id ?? "Identifiant non attribué"}
                    </p>
                  </div>
                  <AdminStatus value={p.verification_status}>
                    {statusLabels[p.verification_status as VerificationState]}
                  </AdminStatus>
                </div>
                <details className="admin-account-id">
                  <summary>Identifiant du compte</summary>
                  <p className="fine">{p.user_id}</p>
                </details>
                {["approved", "suspended"].includes(p.verification_status) && (
                  <details className="admin-account-action">
                    <summary>
                      {p.verification_status === "suspended"
                        ? "Réactiver ce compte"
                        : "Suspendre ce compte"}
                    </summary>
                    <p className="fine">
                      {p.verification_status === "suspended"
                        ? "La réactivation rétablit les accès selon les autorisations existantes."
                        : "La suspension coupe l’accès clinique immédiatement."}
                    </p>
                    <SuspensionForm
                      key={p.verification_status}
                      userId={p.user_id}
                      suspended={p.verification_status === "suspended"}
                    />
                  </details>
                )}
              </article>
            ))
          )}
        </div>
        <div className="pagination">
          {page > 1 && (
            <Link
              href={`?${new URLSearchParams({ q, status, page: String(page - 1) })}`}
            >
              ← Précédent
            </Link>
          )}
          {(count ?? 0) > page * 20 && (
            <Link
              href={`?${new URLSearchParams({ q, status, page: String(page + 1) })}`}
            >
              Suivant →
            </Link>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
