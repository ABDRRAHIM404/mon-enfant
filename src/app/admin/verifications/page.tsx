import Link from "next/link";
import { requireReviewer } from "@/lib/auth";
import { AdminNav } from "@/components/verification/admin-nav";
import { requestStatusLabels } from "@/lib/verification/validation";
export const dynamic = "force-dynamic";
export default async function VerificationQueue({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
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
  const {
    data: requests,
    error,
    count,
  } = await supabase
    .from("verification_requests")
    .select(
      "id,display_name,registration_number,facility_name,status,submitted_at",
      { count: "exact" },
    )
    .eq("status", status)
    .order("submitted_at", { ascending: true })
    .range((page - 1) * 30, page * 30 - 1);
  if (error) throw new Error("Impossible de charger les demandes.");
  return (
    <main className="account-page wide">
      <AdminNav />
      <section className="page-heading">
        <span className="eyebrow">ADMINISTRATION · ACCÈS RESTREINT</span>
        <h1 id="main-content" tabIndex={-1}>
          Vérification des professionnels
        </h1>
        <p className="muted">
          Examinez les qualifications, contrôlez les sources et motivez chaque
          décision.
        </p>
      </section>
      <nav className="tabs" aria-label="Statut des demandes">
        {Object.entries(requestStatusLabels).map(([value, label]) => (
          <Link
            aria-current={status === value ? "page" : undefined}
            key={value}
            href={`?status=${value}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="panel">
        <p className="fine">
          {count ?? 0} demande(s) · Page {page}
        </p>
        {!requests?.length ? (
          <div className="empty-state">Aucune demande dans cette file.</div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Demandes de vérification"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Professionnel</th>
                  <th>Matricule</th>
                  <th>Établissement</th>
                  <th>Soumission</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.display_name}</strong>
                    </td>
                    <td>{r.registration_number}</td>
                    <td>{r.facility_name}</td>
                    <td>
                      {new Date(r.submitted_at).toLocaleDateString("fr-MA", {
                        timeZone: "Africa/Casablanca",
                      })}
                    </td>
                    <td>
                      <Link
                        className="text-link"
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
            <Link href={`?status=${status}&page=${page - 1}`}>← Précédent</Link>
          )}
          {(count ?? 0) > page * 30 && (
            <Link href={`?status=${status}&page=${page + 1}`}>Suivant →</Link>
          )}
        </div>
      </section>
    </main>
  );
}
