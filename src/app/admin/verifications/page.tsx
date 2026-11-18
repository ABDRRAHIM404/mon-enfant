import { NavigationFeedback } from "@/components/workspace-navigation";
import Link from "next/link";
import { requireReviewer } from "@/lib/auth";
import {
  AdminShell,
  AdminHeading,
  AdminStatus,
  AdminEmpty,
} from "@/components/verification/admin-nav";
import { requestStatusLabels } from "@/lib/verification/validation";
export const dynamic = "force-dynamic";
export default async function VerificationQueue({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}) {
  const { supabase } = await requireReviewer();
  const query = await searchParams;
  const status =
    query.status && Object.hasOwn(requestStatusLabels, query.status)
      ? query.status
      : "under_review";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(query.page ?? "1", 10) || 1),
  );
  const q = (query.q ?? "").trim().slice(0, 64);
  let queue = supabase
    .from("verification_requests")
    .select(
      "id,display_name,registration_number,facility_name,status,submitted_at",
      { count: "exact" },
    )
    .eq("status", status);
  if (q)
    queue = queue.ilike(
      "registration_number",
      `%${q.replace(/[\\%_]/g, "\\$&")}%`,
    );
  const {
    data: requests,
    error,
    count,
  } = await queue
    .order("submitted_at", { ascending: true })
    .range((page - 1) * 30, page * 30 - 1);
  if (error) throw new Error("Impossible de charger les demandes.");
  return (
    <AdminShell active="requests">
      <AdminHeading
        section="requests"
        title="Vérifications"
        description="Examinez les qualifications et retrouvez chaque décision dans son historique."
      />
      <section className="panel admin-queue-panel">
        <div className="admin-section-title">
          <div>
            <h2>Demandes des professionnels</h2>
            <p className="muted">
              Sélectionnez une file pour retrouver les dossiers correspondants.
            </p>
          </div>
        </div>
        <nav className="tabs admin-tabs" aria-label="Statut des demandes">
          {Object.entries(requestStatusLabels).map(([value, label]) => (
            <Link
              aria-current={status === value ? "page" : undefined}
              key={value}
              href={`?${new URLSearchParams({ status: value, q })}`}
            >
              {label}
              <NavigationFeedback />
            </Link>
          ))}
        </nav>
        <form className="registry-filters" action="/admin/verifications">
          <input type="hidden" name="status" value={status} />
          <label>
            Matricule déclaré
            <input
              name="q"
              defaultValue={q}
              maxLength={64}
              placeholder="Rechercher un matricule"
            />
          </label>
          <button className="button primary">Rechercher</button>
          <Link
            className="button secondary"
            href={`/admin/verifications?status=${status}`}
          >
            Réinitialiser
          </Link>
        </form>
        <div className="admin-list-meta">
          <p className="fine">
            {count ?? 0} demande(s) · Page {page}
          </p>
          <AdminStatus value={status}>
            {requestStatusLabels[status]}
          </AdminStatus>
        </div>
        {!requests?.length ? (
          <AdminEmpty title="Aucune demande dans cette file">
            Les nouveaux dossiers apparaîtront ici. Vous pouvez consulter les
            autres statuts ci-dessus.
          </AdminEmpty>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Demandes de vérification"
            tabIndex={0}
          >
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Professionnel</th>
                  <th scope="col">Matricule</th>
                  <th scope="col">Établissement</th>
                  <th scope="col">Soumission</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Professionnel">
                      <strong>{r.display_name}</strong>
                    </td>
                    <td data-label="Matricule">{r.registration_number}</td>
                    <td data-label="Établissement">{r.facility_name}</td>
                    <td data-label="Soumission">
                      {new Date(r.submitted_at).toLocaleDateString("fr-MA", {
                        timeZone: "Africa/Casablanca",
                      })}
                    </td>
                    <td data-label="Action">
                      <Link
                        className="button secondary admin-review-link"
                        href={`/admin/verifications/${r.id}`}
                      >
                        Examiner le dossier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          {page > 1 && (
            <Link
              href={`?${new URLSearchParams({ status, q, page: String(page - 1) })}`}
            >
              ← Précédent
            </Link>
          )}
          {(count ?? 0) > page * 30 && (
            <Link
              href={`?${new URLSearchParams({ status, q, page: String(page + 1) })}`}
            >
              Suivant →
            </Link>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
